import { Context } from "probot/lib/context";
import JiraClient from "../../models/jira-client";

export default async (context: Context, _: JiraClient, util) => {
	const { comment } = context.payload;

	const linkifiedBody = await util.unfurl(comment.body);
	if (!linkifiedBody) {
		context.log({ noop: "no_linkified_body_issue_comment" }, "Halting futher execution for issueComment since linkifiedBody is empty");
		return;
	}

	const editedComment = context.issue({
		body: linkifiedBody,
		comment_id: comment.id
	});

	await context.github.issues.updateComment(editedComment);
};
