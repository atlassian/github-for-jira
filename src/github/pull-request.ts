import { Project } from "../models";
import transformPullRequest from "../transforms/pull-request";
import reduceProjectKeys from "../jira/util/reduce-project-keys";
import parseSmartCommit from "../transforms/smart-commit";
import { Context } from "probot/lib/context";

export default async (context: Context, jiraClient, util) => {
  const author = await context.github.users.getByUsername({ username: context.payload.pull_request.user.login });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reviews: any = {};
  try {
    reviews = await context.github.pulls.listReviews({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      pull_number: context.payload.pull_request.number
    });
  } catch (e) {
    context.log.warn({
      error: e,
      payload: context.payload
    }, "Can't retrieve reviewers.");
  }

  const jiraPayload = transformPullRequest(context.payload, author.data, reviews.data);
  const { pull_request: pullRequest } = context.payload;

  if (!jiraPayload && context.payload?.changes?.title) {
    const hasIssueKeys = !!parseSmartCommit(context.payload.changes.title.from);
    if (hasIssueKeys) {
      return jiraClient.devinfo.pullRequest.delete(context.payload.repository.id, pullRequest.number);
    }
  }

  const linkifiedBody = await util.unfurl(pullRequest.body);
  if (linkifiedBody) {
    const editedPullRequest = context.issue({
      body: linkifiedBody,
      id: pullRequest.id
    });
    await context.github.issues.update(editedPullRequest);
  }

  if (!jiraPayload) {
    context.log({ noop: "no_jira_payload_pull_request" }, "Halting futher execution for pull request since jiraPayload is empty");
    return;
  }

  await jiraClient.devinfo.repository.update(jiraPayload);

  const projects = [];
  jiraPayload.pullRequests.map(pull => reduceProjectKeys(pull, projects));
  jiraPayload.branches.map(branch => reduceProjectKeys(branch, projects));

  for (const projectKey of projects) {
    await Project.incrementOccurence(projectKey, jiraClient.baseURL);
  }
};
