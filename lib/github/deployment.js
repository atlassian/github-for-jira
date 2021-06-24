const { Project } = require('../models');
const transformDeployment = require('../transforms/deployment');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');

module.exports = async (context, jiraClient) => {
  if (context.payload.sender.login === 'github-actions[bot]') {
    const { data: jiraPayload } = await transformDeployment(context);

    if (!jiraPayload) {
      context.log({ noop: 'no_jira_payload_deployment' }, 'Halting further execution for deployment since jiraPayload is empty');
      return;
    }

    await jiraClient.deployment.submit(jiraPayload);

    const projects = [];
    reduceProjectKeys(jiraPayload, projects);

    for (const projectKey of projects) {
      await Project.upsert(projectKey, jiraClient.baseURL);
    }
  } else {
    // Solution for releasing MVP of GitHub Actions and avoid data duplication in Jira.
    context.log.warn('Deployment was not initiated by GitHub, skipping it.');
  }
};
