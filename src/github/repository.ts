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

		await subscription.update({ totalNumberOfRepos: (subscription.totalNumberOfRepos || 0) + 1 });
		await findOrStartSync(subscription, context.log, false, "partial");
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

	const jiraResponse = await jiraClient.devinfo.repository.delete(
		transformRepositoryId(context.payload.repository?.id, context.gitHubAppConfig?.gitHubBaseUrl)
	);

	// Update the total number of repos, we can assume atleast 1 repo(just deleted repo) exists for the default value
	const totalNumberOfRepos = ((subscription.totalNumberOfRepos || 1) - 1);
	await subscription.update({ totalNumberOfRepos });
	await RepoSyncState.deleteRepoForSubscription(subscription, context.payload.repository?.id);
	webhookProcessComplete(context, jiraResponse?.status);
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
