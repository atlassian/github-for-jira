import transformBranch from "../transforms/branch";
import { Context } from "probot/lib/context";
import issueKeyParser from "jira-issue-key-parser";
import { isEmpty } from "../../common/isEmpty";

export const createBranch = async (context: Context, jiraClient) => {
	const { data: jiraPayload } = await transformBranch(context);

	if (!jiraPayload) {
		context.log(
			{ noop: "no_jira_payload_create_branch" },
			"Halting further execution for createBranch since jiraPayload is empty"
		);
		return;
	}

	await jiraClient.devinfo.repository.update(jiraPayload);
};

export const deleteBranch = async (context, jiraClient) => {
	const issueKeys = issueKeyParser().parse(context.payload.ref);

	if (isEmpty(issueKeys)) {
		context.log(
			{ noop: "no_issue_keys" },
			"Halting further execution for deleteBranch since issueKeys is empty"
		);
		return undefined;
	}

	await jiraClient.devinfo.branch.delete(
		context.payload.repository.id,
		context.payload.ref
	);
};
