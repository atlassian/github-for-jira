const { Project } = require('../models');
const transformBranch = require('../transforms/branch');
const parseSmartCommit = require('../transforms/smart-commit');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');

module.exports.createBranch = async (context, jiraClient) => {
  const { data: jiraPayload } = await transformBranch(context);

  if (!jiraPayload) {
    context.log({ noop: 'no_jira_payload_create_branch' }, 'Halting further execution for createBranch since jiraPayload is empty');
    return;
  }

  await jiraClient.devinfo.repository.update(jiraPayload);

  const projects = [];
  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects));

  for (const projectKey of projects) {
    await Project.upsert(projectKey, jiraClient.baseURL);
  }
};

module.exports.deleteBranch = async (context, jiraClient) => {
  const { issueKeys } = parseSmartCommit(context.payload.ref);

  if (!issueKeys) {
    context.log({ noop: 'no_issue_keys' }, 'Halting further execution for deleteBranch since issueKeys is empty');
    return;
  }

  await jiraClient.devinfo.branch.delete(
    context.payload.repository.id,
    context.payload.ref,
  );
};
