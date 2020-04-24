const { Subscription } = require('../models');
const enhanceOctokit = require('../config/enhance-octokit');
const getJiraClient = require('../jira/client');
const getJiraUtil = require('../jira/util');
const newrelic = require('newrelic');
const pullRequest = require('../github/pull-request');

const jobOpts = {
  removeOnFail: true,
  attempts: 3,
};

module.exports = (app, queues) => async function (job) {
  const { callbackName, context } = job.data;
  const gitHubInstallationId = context.payload.installation.id;
  const github = await app.auth(gitHubInstallationId);
  enhanceOctokit(github, app.log);
  context.log = app.log.child({ gitHubInstallationId });
  context.github = github;

  let webhookEvent = context.name;
  if (context.payload.action) {
    webhookEvent = `${webhookEvent}.${context.payload.action}`;
  }
  newrelic.addCustomAttributes({
    'Webhook ID': context.id,
    'Webhook Event': webhookEvent,
    Repository: context.payload.repository,
  });
  job.sentry.setTag('webhookId', context.id);
  job.sentry.setTag('transaction', `webhook:${webhookEvent}`);
  job.sentry.setExtra('GitHub Payload', {
    event: context.name,
    action: context.payload.action,
    id: context.id,
  });

  const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId);
  if (!subscriptions.length) {
    context.log({ noop: 'no_subscriptions' }, 'Halting futher execution since no subscriptions were found');
    return;
  }

  for (const subscription of subscriptions) {
    const { jiraHost } = subscription;
    job.sentry.setTag('jiraHost', jiraHost);
    job.sentry.setTag('gitHubInstallationId', gitHubInstallationId);
    job.sentry.setUser({ jiraHost, gitHubInstallationId });
    context.log = context.log.child({ jiraHost });
    if (context.timedout) {
      Sentry.captureMessage('Timed out jira middleware iterating subscriptions');
      context.log.error({ timeout: true, timeoutElapsed: context.timedout }, `Timing out at after ${context.timedout}ms`);
      return;
    }

    const jiraClient = await getJiraClient(jiraHost, gitHubInstallationId, context.log);
    if (jiraClient == null) {
      // Don't call callback if we have no jiraClient
      context.log.error({ noop: 'no_jira_client' }, `No enabled installation found for ${jiraHost}.`);
      return;
    }
    const util = getJiraUtil(jiraClient);

    const callback = pullRequest;

    try {
      await newrelic.startSegment('webhook handler', true, async () => callback(context, jiraClient, util));
    } catch (err) {
      // TODO will remove. Using this for local dev
      context.log('caught an error', { err });
      job.sentry.captureException(err);
    }
  }
};
