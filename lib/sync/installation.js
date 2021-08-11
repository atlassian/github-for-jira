const { Subscription } = require('../models');
const getJiraClient = require('../jira/client');
const { getRepositorySummary } = require('./jobs');
const enhanceOctokit = require('../config/enhance-octokit');
const statsd = require('../config/statsd');
const probotApp = require('../worker/app');
const { getLog } = require('../config/logger');

let logger = getLog();

const tasks = {
  pull: require('./pull-request').getPullRequests,
  branch: require('./branches').getBranches,
  commit: require('./commits').getCommits,
};
const taskTypes = Object.keys(tasks);

const updateNumberOfReposSynced = async (repos, subscription) => {
  const repoIds = Object.keys(repos);

  const syncedRepos = repoIds.filter((id) => {
    // all 3 statuses need to be complete for a repo to be fully synced
    const { pullStatus, branchStatus, commitStatus } = repos[id];
    return pullStatus === 'complete' && branchStatus === 'complete' && commitStatus === 'complete';
  });

  await subscription.update({ 'repoSyncState.numberOfSyncedRepos': syncedRepos.length });
};

const sortedRepos = (repos) => Object.entries(repos).sort((a, b) =>
  new Date(b[1].repository.updated_at) - new Date(a[1].repository.updated_at));

const getNextTask = (subscription) => {
  const { repos } = subscription.get('repoSyncState');
  updateNumberOfReposSynced(repos, subscription);

  for (const [repositoryId, repoData] of sortedRepos(repos)) {
    const task = taskTypes.find(taskType => repoData[`${taskType}Status`] !== 'complete');
    if (!task) continue;
    const { repository, [getCursorKey(task)]: cursor } = repoData;
    return {
      task, repositoryId, repository, cursor,
    };
  }
};

const upperFirst = str => str.substring(0, 1).toUpperCase() + str.substring(1);
const getCursorKey = jobType => `last${upperFirst(jobType)}Cursor`;

/**
 * @param {any} queues - TBD
 */
const processInstallation = (queues) => {
  const updateJobStatus = async (jiraClient, job, edges, task, repositoryId, app) => {
    const { installationId, jiraHost } = job.data;
    // Get a fresh subscription instance
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);

    // handle promise rejection when an org is removed during a sync
    if (subscription == null) {
      logger.info('Organization has been deleted. Other active syncs will continue.');
      return;
    }

    const status = edges.length > 0 ? 'pending' : 'complete';
    logger.info(`Updating job status for installationId=${installationId}, repositoryId=${repositoryId}, task=${task}, status=${status}`);
    subscription.set(`repoSyncState.repos.${repositoryId}.${task}Status`, status);
    if (edges.length > 0) {
      // there's more data to get
      subscription.set(`repoSyncState.repos.${repositoryId}.${getCursorKey(task)}`, edges[edges.length - 1].cursor);
      await subscription.save();

      const { removeOnComplete, removeOnFail } = job.opts;
      const delay = Number(process.env.LIMITER_PER_INSTALLATION) || 1000;
      queues.installation.add(job.data, {
        attempts: 3, delay, removeOnComplete, removeOnFail,
      });
    } else {
      // no more data (last page was processed of this job type)
      if (!getNextTask(subscription)) {
        subscription.set('syncStatus', 'COMPLETE');
        let message = `Sync status for installationId=${installationId} is complete`;
        if (job.data.startTime !== undefined) {
          const endTime = new Date();
          const timeDiff = endTime - Date.parse(job.data.startTime);
          message = `${message} startTime=${job.data.startTime} endTime=${endTime.toJSON()} diff=${timeDiff}`;

          // full_sync measures the duration from start to finish of a complete scan and sync of github issues translated to tickets
          // startTime will be passed in when this sync job is queued from the discovery
          statsd.histogram('full_sync', timeDiff);
        }
        logger.info(message);

        try {
          await jiraClient.devinfo.migration.complete();
        } catch (err) {
          logger.error(err, 'Error sending the `complete` event to JIRA');
        }
      } else {
        logger.info(`Sync status for installationId=${installationId} is pending`);
        const { removeOnComplete, removeOnFail } = job.opts;
        queues.installation.add(job.data, { attempts: 3, removeOnComplete, removeOnFail });
      }
    }
    await subscription.save();
  };

  async function getEnhancedGitHub(app, installationId) {
    const github = await app.auth(installationId);
    enhanceOctokit(github, logger);
    return github;
  }

  return async function (job) {
    const { installationId, jiraHost } = job.data;
    const app = await probotApp(jiraHost);

    job.sentry.setUser({ gitHubInstallationId: installationId, jiraHost });

    logger.info(`Starting job for installationId=${installationId}`);

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId);
    if (!subscription) return;

    const jiraClient = await getJiraClient(subscription.jiraHost, installationId, logger);
    const github = await getEnhancedGitHub(app, installationId);

    const nextTask = getNextTask(subscription);
    if (!nextTask) {
      await subscription.update({ syncStatus: 'COMPLETE' });
      return;
    }

    await subscription.update({ syncStatus: 'ACTIVE' });

    const { task, repositoryId, cursor } = nextTask;
    let { repository } = nextTask;
    if (!repository) {
      // Old records don't have this info. New ones have it
      const { data: repo } = await github.request('GET /repositories/:id', { id: repositoryId });
      repository = getRepositorySummary(repo);
      subscription.set(`repoSyncState.repos.${repository.id}.repository`, repository);
      await subscription.save();
    }
    logger.info(`Starting task for installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`);

    const processor = tasks[task];

    const pagedProcessor = (perPage) => processor(github, repository, cursor, perPage);

    const handleGitHubError = (err) => {
      if (err.errors) {
        const ignoredErrorTypes = ['MAX_NODE_LIMIT_EXCEEDED'];
        const notIgnoredError = err.errors.filter(error => !ignoredErrorTypes.includes(error.type)).length;

        if (notIgnoredError) {
          throw (err);
        }
      } else {
        throw (err);
      }
    };

    const execute = async () => {
      for (const perPage of [20, 10, 5, 1]) {
        try {
          return await pagedProcessor(perPage);
        } catch (err) {
          handleGitHubError(err);
        }
      }
      throw new Error(`Error processing GraphQL query: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`);
    };

    try {
      const { edges, jiraPayload } = await execute();
      if (jiraPayload) {
        try {
          await jiraClient.devinfo.repository.update(jiraPayload, { preventTransitions: true });
        } catch (err) {
          if (err.response && err.response.status === 400) {
            job.sentry.setExtra('Response body', err.response.data.errorMessages);
            job.sentry.setExtra('Jira payload', err.response.data.jiraPayload);
          }

          if (err.request) {
            job.sentry.setExtra('Request', { host: err.request.domain, path: err.request.path, method: err.request.method });
          }

          if (err.response) {
            job.sentry.setExtra('Response', {
              status: err.response.status,
              statusText: err.response.statusText,
              body: err.response.body,
            });
          }

          throw err;
        }
      }
      await updateJobStatus(jiraClient, job, edges, task, repositoryId, app);
    } catch (err) {
      const reteLimit = +(err.headers && err.headers['x-ratelimit-reset']);
      const delay = Math.max(Date.now() - reteLimit * 1000, 0);
      if (delay) { // if not NaN or 0
        logger.warn(`Delaying job for ${delay}ms installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`);
        const { removeOnComplete, removeOnFail } = job.opts;
        queues.installation.add(job.data, { delay, removeOnComplete, removeOnFail });
        return;
      }
      if (String(err).includes('connect ETIMEDOUT')) {
        // There was a network connection issue.
        // Add the job back to the queue with a 5 second delay
        logger.warn(`ETIMEDOUT error, retrying in 5 seconds: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`);
        const { removeOnComplete, removeOnFail } = job.opts;
        queues.installation.add(job.data, { delay: 5000, removeOnComplete, removeOnFail });
        return;
      }
      if (String(err.message).includes('You have triggered an abuse detection mechanism')) {
        // Too much server processing time, wait 60 seconds and try again
        logger.warn(`Abuse detection triggered. Retrying in 60 seconds: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`);
        const { removeOnComplete, removeOnFail } = job.opts;
        queues.installation.add(job.data, { delay: 60000, removeOnComplete, removeOnFail });
        return;
      }
      // Checks if parsed error type is NOT_FOUND: https://github.com/octokit/graphql.js/tree/master#errors
      const isNotFoundError = err.errors && err.errors.filter(error => error.type === 'NOT_FOUND').length;
      if (isNotFoundError) {
        logger.info(`Repository deleted after discovery, skipping initial sync: installationId=${installationId}, repositoryId=${repositoryId}, task=${task}`);

        const edgesLeft = []; // No edges left to process since the repository doesn't exist
        await updateJobStatus(jiraClient, job, edgesLeft, task, repositoryId, app);
        return;
      }

      await subscription.update({ syncStatus: 'FAILED' });
      throw err;
    }
  };
};


module.exports = {
  processInstallation,
  sortedRepos,
};
