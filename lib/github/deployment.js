const { Project } = require('../models');
const transformDeployment = require('../transforms/deployment');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');

module.exports = async (context, jiraClient) => {
  const { data: jiraPayload } = await transformDeployment(context);

  if (!jiraPayload) {
    context.log({ noop: 'no_jira_payload_deployment' }, 'Halting further execution for deployment since jiraPayload is empty');
    return;
  }

  await jiraClient.deployment.submit(jiraPayload);

  const projects = reduceProjectKeys(jiraPayload);

  for (const projectKey of projects) {
    await Project.upsert(projectKey, jiraClient.baseURL);
  }
};
