import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { findOrStartSync } from "~/src/sync/sync-utils";

export const repositoryWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	if (context.action === "deleted") {
		return deleteRepositoryWebhookHandler(context, jiraClient, gitHubInstallationId);
	}
	if (context.action === "created") {
		return createRepositoryWebhookHandler(context, gitHubInstallationId, subscription);
	}
};

export const deleteRepositoryWebhookHandler = async (context: WebhookContext, jiraClient, gitHubInstallationId: number): Promise<void> => {
	context.log = context.log.child({
		jiraHost: jiraClient.baseURL,
		gitHubInstallationId
	});
	context.log.info(`Deleting dev info for repo ${context.payload.repository?.id}`);

	const jiraResponse = await jiraClient.devinfo.repository.delete(
		await transformRepositoryId(context.payload.repository?.id, context.gitHubAppConfig?.gitHubBaseUrl)
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

export const createRepositoryWebhookHandler = async (context: WebhookContext, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {

	let status: number;
	context.log = context.log.child({
		gitHubInstallationId
	});
	if (subscription.totalNumberOfRepos === undefined) {
		return;
	}

	try {
		const { payload: { repository } } = context;
		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: repository.id,
			repoName: repository.name,
			repoFullName: repository.full_name,
			repoOwner: repository.owner.login,
			repoUrl: repository.html_url,
			repoUpdatedAt: new Date(repository.updated_at)
		});
		await subscription.update({ totalNumberOfRepos: subscription.totalNumberOfRepos + 1 });
		await findOrStartSync(subscription, context.log, "partial");
		status = 200;
	} catch (err) {
		context.log.error({ err }, "Error processing create repository webhook");
		status = 500;
	}

	const { webhookReceived, name, log } = context;
	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		status, // No jira reponse at this stage so db result here
		context.gitHubAppConfig?.gitHubAppId
	);
};
