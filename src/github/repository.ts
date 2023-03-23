import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { booleanFlag, BooleanFlags } from "config/feature-flags";


export const repositoryWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	if (context.action === "deleted") {
		return deleteRepositoryWebhookHandler(context, jiraClient, gitHubInstallationId, subscription);
	}
	if (context.action === "created" && await booleanFlag(BooleanFlags.REPO_CREATED_EVENT, jiraClient.baseURL)) {
		return createRepositoryWebhookHandler(context, gitHubInstallationId, subscription);
	}
};

const updateRepoCount = async (subscription: Subscription) => {
	// Update the repos by taking the new post-delete count of repos for the given subscription
	const totalNumberOfRepos = (await RepoSyncState.findAllFromSubscription(subscription)).length;
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
		await findOrStartSync(subscription, context.log, "partial", subscription.backfillSince,undefined, { trigger: "create-repo-webhook" });
		webhookProcessComplete(context, 200);
	} catch (err) {
		context.log.error({ err }, "Error processing create repository webhook");
		webhookProcessComplete(context, 500);
	}
};

export const deleteRepositoryWebhookHandler = async (context: WebhookContext, jiraClient, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	context.log = context.log.child({
		jiraHost: jiraClient.baseURL,
		gitHubInstallationId
	});
	context.log.info(`Deleting dev info for repo ${context.payload.repository?.id}`);

	try {
		const jiraResponse = await jiraClient.devinfo.repository.delete(
			transformRepositoryId(context.payload.repository?.id, context.gitHubAppConfig?.gitHubBaseUrl)
		);

		// Only attempt to delete if we have the ID
		if (context?.payload?.repository?.id) {
			await RepoSyncState.deleteRepoForSubscription(subscription, context.payload.repository.id);
			await updateRepoCount(subscription);
		}
		webhookProcessComplete(context, jiraResponse?.status);
	} catch (err) {
		context.log.error({ err }, "Error processing delete repository webhook");
		webhookProcessComplete(context, 500);
	}
};

const webhookProcessComplete = (context: WebhookContext, status: number) => {
	const { webhookReceived, name, log } = context;
	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		status,
		context.gitHubAppConfig?.gitHubAppId
	);
};
