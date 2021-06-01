const { Project } = require('../models');
const transformBranch = require('../transforms/branch');
const parseSmartCommit = require('../transforms/smart-commit');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');
const logger = require('../../config/logger');

module.exports.createBranch = async (context, jiraClient) => {
  const { data: jiraPayload } = await transformBranch(context);

  if (!jiraPayload) {
    logger.error({ noop: 'no_jira_payload_create_branch' }, 'Halting futher execution for createBranch since jiraPayload is empty');
    return;
  }

  try {
    await jiraClient.devinfo.repository.update(jiraPayload);
  } catch (err) {
    logger.error(`Error updating branch: ${err}`);
  }

  const projects = [];
  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects));

  for (const projectKey of projects) {
    try {
      await Project.upsert(projectKey, jiraClient.baseURL);
    } catch (err) {
      logger.error(`Error upserting branch: ${err}`);
    }
  }
};

module.exports.deleteBranch = async (context, jiraClient) => {
  const { issueKeys } = parseSmartCommit(context.payload.ref);

  if (!issueKeys) {
    logger.error({ noop: 'no_issue_keys' }, 'Halting futher execution for deleteBranch since issueKeys is empty');
    return;
  }

  try {
    await jiraClient.devinfo.branch.delete(
      context.payload.repository.id,
      context.payload.ref,
    );
  } catch (err) {
    logger.error(`Error deleting branch: ${err}`);
  }
};
