const { Project } = require('../models');
const transformWorkflows = require('../transforms/workflow');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');

module.exports = async (context, jiraClient) => {
  const { data: jiraPayload } = transformWorkflows(context.payload);

  if (!jiraPayload) {
    context.log({ noop: 'no_jira_payload_check_run' }, 'Halting further execution for check since jiraPayload is empty');
    return;
  }

  await jiraClient.workflow.submit(jiraPayload);

  const projects = [];
  reduceProjectKeys(jiraPayload, projects);

  for (const projectKey of projects) {
    await Project.upsert(projectKey, jiraClient.baseURL);
  }
};
