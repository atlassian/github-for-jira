import { Project } from '../models';
import transformBranch from '../transforms/branch';
import parseSmartCommit from '../transforms/smart-commit';
import reduceProjectKeys from '../jira/util/reduce-project-keys';
import {Context} from 'probot/lib/context';

export const createBranch = async (context:Context, jiraClient) => {
  const { data: jiraPayload } = await transformBranch(context);

  if (!jiraPayload) {
    context.log({ noop: 'no_jira_payload_create_branch' }, 'Halting futher execution for createBranch since jiraPayload is empty');
    return;
  }

  await jiraClient.devinfo.repository.update(jiraPayload);

  const projects = [];
  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects));

  for (const projectKey of projects) {
    await Project.incrementOccurence(projectKey, jiraClient.baseURL);
  }
};

export const deleteBranch = async (context, jiraClient) => {
  const { issueKeys } = parseSmartCommit(context.payload.ref);

  if (!issueKeys) {
    context.log({ noop: 'no_issue_keys' }, 'Halting futher execution for deleteBranch since issueKeys is empty');
    return;
  }

  await jiraClient.devinfo.branch.delete(
    context.payload.repository.id,
    context.payload.ref,
  );
};
