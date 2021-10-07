import JiraClient from "../models/jira-client";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { CustomContext } from "./middleware";

export default async (context: CustomContext, _: JiraClient, util): Promise<void> => {
	const { issue } = context.payload;

	let linkifiedBody;
	try {
		linkifiedBody = await util.unfurl(issue.body);
		if (!linkifiedBody) {
			context.log("Halting further execution for issue since linkifiedBody is empty");
			return;
		}
	} catch (err) {
		context.log.warn(
			{ err, linkifiedBody, body: issue.body },
			"Error while trying to find jira keys in issue body"
		);
	}

	const editedIssue = context.issue({
		body: linkifiedBody,
		id: issue.id
	});

	context.log(`Updating issue in GitHub with issueId: ${issue.id}`);

	const githubResponse = await context.github.issues.update(editedIssue);
	const { webhookReceived, name, log } = context;

	if (
		(await booleanFlag(BooleanFlags.WEBHOOK_RECEIVED_METRICS, false)) &&
		webhookReceived
	) {
		emitWebhookProcessedMetrics(
			webhookReceived,
			name,
			log,
			githubResponse?.status
		);
	}
};
