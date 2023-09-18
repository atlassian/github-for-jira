import { enqueuePush } from "../transforms/push";
import { getCurrentTime } from "utils/webhook-utils";
import { hasJiraIssueKey } from "utils/jira-utils";
import { updateRepoConfig } from "services/user-config-service";
import { GitHubPushData } from "interfaces/github";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { Subscription } from "models/subscription";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { getCloudOrServerFromGitHubAppId } from "../util/get-cloud-or-server";
import { createInstallationClient } from "utils/get-github-client-config";


export const pushWebhookHandler = async (context: WebhookContext, jiraClient, _util, gitHubInstallationId: number, subscription: Subscription): Promise<void> => {
	const webhookReceived = getCurrentTime();

	// Copy the shape of the context object for processing
	// but filter out any commits that don't have issue keys
	// so we don't have to process them.
	const payload: GitHubPushData = {
		webhookId: context.id,
		webhookReceived,
		repository: context.payload?.repository,
		commits: context.payload?.commits?.reduce((acc, commit) => {
			if (hasJiraIssueKey(commit.message)) {
				acc.push(commit);
			}
			return acc;
		}, []),
		installation: context.payload?.installation
	};

	const jiraHost = jiraClient.baseURL;
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;
	const gitHubProduct = getCloudOrServerFromGitHubAppId(context.gitHubAppConfig?.gitHubAppId);
	await sendAnalytics(jiraHost, AnalyticsEventTypes.TrackEvent, {
		action: AnalyticsTrackEventsEnum.CommitsPushedTrackEventName,
		actionSubject: AnalyticsTrackEventsEnum.CommitsPushedTrackEventName,
		source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise
	}, {
		gitHubProduct,
		jiraHost,
		totalCommitCount: context.payload?.commits?.length || 0,
		commitWithJiraIssueKeyCount: payload.commits?.length || 0
	});

	context.log = context.log.child({
		jiraHost,
		gitHubInstallationId
	});

	if (subscription) {
		const modifiedFiles = context.payload?.commits?.reduce((acc, commit) =>
			([...acc, ...commit.added, ...commit.modified, ...commit.removed]), []);
		// TODO: this call must be updated to support GitHub Server events
		const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraHost, { trigger: "webhook", subTrigger: "push" }, context.log, gitHubAppId);
		await updateRepoConfig(subscription, payload.repository.id, gitHubInstallationClient, context.log, modifiedFiles);
	} else {
		context.log.warn("could not load user config because subscription does not exist");
	}

	if (!payload.commits?.length) {
		context.log.info(
			{ noop: "no_commits" },
			"Halting further execution for push since no commits were found for the payload"
		);
		return;
	}

	context.log.info("Enqueueing push event");
	await enqueuePush(payload, jiraClient.baseURL, context.log, context.gitHubAppConfig);
};
