import transformDeployment from "../transforms/deployment";
import { emitWebhookProcessedMetrics } from "../util/webhooks";
import { CustomContext } from "./middleware";
import { AxiosResponse } from "axios";

export default async (context: CustomContext, jiraClient): Promise<void> => {
	const jiraPayload = await transformDeployment(context);

	if (!jiraPayload) {
		context.log(
			{noop: "no_jira_payload_deployment"},
			"Halting further execution for deployment since jiraPayload is empty"
		);
		return;
	}

	const jiraResponse: AxiosResponse = await jiraClient.deployment.submit(jiraPayload);

	if (jiraResponse.data?.rejectedDeployments?.length) {
		context.log.warn({rejectedDeployments: jiraResponse.data.rejectedDeployments}, "Jira API rejected deployment!");
	}

	const {webhookReceived, name, log} = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status
	);
};
