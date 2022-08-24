import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";

export const deleteRepository = async (context, jiraClient, _util, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		jiraHost: jiraClient.baseURL,
		gitHubInstallationId
	});

	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

	context.log({ repoId: context.payload.repository?.id, gitHubProduct }, "Deleting dev info for repo.");

	const jiraResponse = await jiraClient.devinfo.repository.delete(
		context.payload.repository?.id
	);
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		jiraResponse?.status,
		context.gitHubAppConfig?.gitHubAppId
	);
};
