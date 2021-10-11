import transformDeployment from "../transforms/deployment";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import { DeploymentsResult } from "../jira/client";

export default async (context: CustomContext, jiraClient): Promise<void> => {
	const jiraPayload = await transformDeployment(context);

	if (!jiraPayload) {
		context.log(
			{ noop: "no_jira_payload_deployment" },
			"Halting further execution for deployment since jiraPayload is empty"
		);
		return;
	}

	const result: DeploymentsResult = await jiraClient.deployment.submit(jiraPayload);
	if (result.rejectedDeployments?.length) {
		context.log.warn({ rejectedDeployments: result.rejectedDeployments }, "Jira API rejected deployment!");
	}

	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		result?.status
	);
};
