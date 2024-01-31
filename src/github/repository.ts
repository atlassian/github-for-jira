import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { findOrStartSync } from "~/src/sync/sync-utils";

export const repositoryWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	if (context.action === "deleted") {
		return deleteRepositoryWebhookHandler(context, jiraClient, gitHubInstallationId, subscription);
	}
	if (context.action === "created") {
		return createRepositoryWebhookHandler(context, gitHubInstallationId, subscription);
	}
};

const updateRepoCount = async (subscription: Subscription) => {
	// Update the repos by taking the new post-delete count of repos for the given subscription
	const totalNumberOfRepos = await RepoSyncState.countSubscriptionRepos(subscription);
	await subscription.update({ totalNumberOfRepos });
};

export const createRepositoryWebhookHandler = async (context: WebhookContext, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	const { payload: { repository } } = context;
	context.log = context.log.child({ gitHubInstallationId });

	try {
		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: repository.id,
			repoName: repository.name,
			repoFullName: repository.full_name,
			repoOwner: repository.owner.login,
			repoUrl: repository.html_url,
			repoUpdatedAt: new Date(repository.updated_at)
		});

		await updateRepoCount(subscription);
		await findOrStartSync(subscription, context.log, "partial", subscription.backfillSince,undefined, { source: "create-repo-webhook" });
		webhookProcessComplete(context, 200, subscription.jiraHost);
	} catch (err: unknown) {
		context.log.error({ err }, "Error processing create repository webhook");
		webhookProcessComplete(context, 500, subscription.jiraHost);
	}
};

export const deleteRepositoryWebhookHandler = async (context: WebhookContext, jiraClient, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	context.log = context.log.child({
		jiraHost: jiraClient.baseURL,
		gitHubInstallationId
	});

	if (!context?.payload?.repository?.id) {
		context.log.warn("Cannot delete repository. Missing repository ID");
		webhookProcessComplete(context, 500, subscription.jiraHost);
		return;
	}

	context.log.info(`Deleting dev info for repo ${context.payload.repository?.id as number}`);

	const { id: repositoryId } = context.payload.repository;

	try {
		const jiraResponse = await jiraClient.devinfo.repository.delete(
			repositoryId,  context.gitHubAppConfig?.gitHubBaseUrl
		);

		await	RepoSyncState.deleteRepoForSubscription(subscription, repositoryId);
		await	updateRepoCount(subscription);

		webhookProcessComplete(context, jiraResponse?.status, subscription.jiraHost);
	} catch (err: unknown) {
		context.log.error({ err }, "Error processing delete repository webhook");
		webhookProcessComplete(context, 500, subscription.jiraHost);
	}
};

const webhookProcessComplete = (context: WebhookContext, status: number, jiraHost: string) => {
	const { webhookReceived, name, log } = context;
	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		jiraHost,
		log,
		status,
		context.gitHubAppConfig?.gitHubAppId
	);
};
