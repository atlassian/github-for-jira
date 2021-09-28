import transformBranch from "../transforms/branch";
import { Context } from "probot/lib/context";
import issueKeyParser from "jira-issue-key-parser";
import _ from "lodash";

export const createBranch = async (context: Context, jiraClient): Promise<void> => {
	const jiraPayload = await transformBranch(context);

	if (!jiraPayload) {
		context.log("Halting further execution for createBranch since jiraPayload is empty");
		return;
	}

	context.log(`Sending jira update for create branch event for hostname: ${jiraClient.baseURL}`)

	await jiraClient.devinfo.repository.update(jiraPayload);
};

export const deleteBranch = async (context, jiraClient): Promise<void> => {
	const issueKeys = issueKeyParser().parse(context.payload.ref);

	if (_.isEmpty(issueKeys)) {
		context.log(
			{ noop: "no_issue_keys" },
			"Halting further execution for deleteBranch since issueKeys is empty"
		);
		return undefined;
	}

	context.log(`Deleting branch for repo ${context.payload.repository?.id} with ref ${context.payload.ref}`)

	await jiraClient.devinfo.branch.delete(
		context.payload.repository?.id,
		context.payload.ref
	);
};
