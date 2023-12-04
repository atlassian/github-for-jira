import { processPush } from "../transforms/push";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { MessageHandler, PushQueueMessagePayload, SQSMessageContext } from "./sqs.types";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const pushQueueMessageHandler: MessageHandler<PushQueueMessagePayload> = async (context: SQSMessageContext<PushQueueMessagePayload>) => {
	const { payload } = context;
	// validate payload before using it
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (payload.repository === undefined || payload.repository.full_name === undefined || payload.shas === undefined || payload.webhookId === undefined) {
		context.log.error({ payload }, "Missing required fields");
		return;
	}

	const { webhookId, installationId, jiraHost } = payload;
	context.log = context.log.child({
		webhookId,
		jiraHost,
		gitHubInstallationId: installationId
	});

	if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
		context.log.info({ installationId }, "verbose logging - Handling push message from the SQS queue");
	} else {
		context.log.info("Handling push message from the SQS queue");
	}

	const metrics = {
		trigger: "webhook",
		subTrigger: "push"
	};
	const gitHubInstallationClient = await createInstallationClient(installationId, jiraHost, metrics, context.log, payload.gitHubAppConfig?.gitHubAppId);
	await processPush(gitHubInstallationClient, payload, context.log);
};
