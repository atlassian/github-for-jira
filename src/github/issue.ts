import { CustomContext } from "./middleware";
import JiraClient from "../models/jira-client";

export default async (context: CustomContext, _: JiraClient, util): Promise<void> => {
	const { issue } = context.payload;

	const linkifiedBody = await util.unfurl(issue.body);
	if (!linkifiedBody) {
		context.log({ noop: "no_linkified_body_issue" }, "Halting further execution for issue since linkifiedBody is empty");
		return;
	}

	const editedIssue = context.issue({
		body: linkifiedBody,
		id: issue.id
	});

	context.log(`Updating issue in GitHub with issueId: ${issue.id}`)
	await context.github.issues.update(editedIssue);
};
