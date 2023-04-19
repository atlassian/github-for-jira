import { Request, Response } from "express";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { statsd } from "~/src/config/statsd";
import { metricCreateBranch } from "~/src/config/metric-names";
import { getCloudOrServerFromGitHubAppId } from "~/src/util/get-cloud-or-server";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";

const getErrorMessages = (statusCode: number): string => {
	switch (statusCode) {
		case 403: {
			return "We couldn’t create this branch, possibly because this GitHub repository hasn't been configured to your Jira site.";
		}
		case 400: {
			return "We couldn’t create this branch. Check that you’ve entered valid values for repository, source branch name, and new branch name.";
		}
		case 422: {
			return "We couldn’t create this branch, possibly because:<ul>" +
			"<li>This GitHub branch already exists. Please try a different branch name.</li>" +
			"<li>The GitHub branch name is not valid.</li>" +
			"</ul>";
		}
		case 404: {
			return "We couldn’t create this branch, possibly because the GitHub source branch you entered doesn't exist. Please try a different branch.";
		}
		case 500:
		default: {
			return "We couldn’t create this branch because something went wrong. Please try again.";
		}
	}
};

export const GithubCreateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { gitHubAppConfig, jiraHost } = res.locals;
	const { owner, repo, sourceBranchName, newBranchName } = req.body;
	const logger = getLogger("github-create-branch-options-get", {
		fields: req.log?.fields
	});

	if (!owner || !repo || !sourceBranchName || !newBranchName) {
		logger.warn("Missing required data.");
		res.status(400).json({ error: getErrorMessages(400) });
		return;
	}

	try {
		const subscription = await Subscription.findForRepoNameAndOwner(repo, owner, jiraHost);

		if (!subscription) {
			logger.error("No Subscription found.");
			throw Error("No Subscription found.");
		}

		const gitHubInstallationClient = await createInstallationClient(subscription.gitHubInstallationId, jiraHost, { trigger: "github-branches-get" }, req.log, gitHubAppConfig.gitHubAppId);
		const baseBranchSha = (await gitHubInstallationClient.getReference(owner, repo, sourceBranchName)).data.object.sha;
		await gitHubInstallationClient.createReference(owner, repo, {
			owner,
			repo,
			ref: `refs/heads/${newBranchName}`,
			sha: baseBranchSha
		});
		res.sendStatus(200);

		logger.info("Branch create successful.");
		sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchSuccessTrackEventName, jiraHost);
		const tags = {
			name: newBranchName,
			gitHubProduct: getCloudOrServerFromGitHubAppId(gitHubAppConfig.githubAppId)
		};
		statsd.increment(metricCreateBranch.created, tags);
	} catch (err) {
		logger.error({ err }, getErrorMessages(err.status));
		res.status(err.status).json({ error: getErrorMessages(err.status) });
		sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchErrorTrackEventName, jiraHost);
		statsd.increment(metricCreateBranch.failed, {
			name: newBranchName
		});
	}
};

const sendTrackEventAnalytics = (name: string, jiraHost: string) => {
	sendAnalytics(AnalyticsEventTypes.TrackEvent, {
		name,
		source: AnalyticsTrackSource.CreateBranch,
		jiraHost
	});
};
