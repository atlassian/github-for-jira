const { Project } = require('../models');
const transformWorkflows = require('../transforms/workflow');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');

module.exports = async (context, jiraClient) => {
  const { data: jiraPayload } = await transformWorkflows(context.payload);

  if (!jiraPayload) {
    context.log({ noop: 'no_jira_payload_workflow_run' }, 'Halting further execution for workflow since jiraPayload is empty');
    return;
  }

  await jiraClient.workflow.submit(jiraPayload);

  const projects = [];
  jiraPayload.builds.map(build => reduceProjectKeys(build, projects));

  for (const projectKey of projects) {
    await Project.upsert(projectKey, jiraClient.baseURL);
  }
};
