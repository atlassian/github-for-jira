import { Request, Response } from "express";
import { createInstallationClient } from "~/src/util/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { statsd } from "~/src/config/statsd";
import { metricCreateBranch } from "~/src/config/metric-names";
import { getCloudOrServerFromGitHubAppId } from "~/src/util/get-cloud-or-server";
import { Subscription } from "models/subscription";
import { getLogger } from "config/logger";
import { Errors } from "config/errors";

const getErrorMessages = (statusCode: number): string => {
	switch (statusCode) {
		case 403: {
			return "We couldn’t create this branch, because GitHub for Jira app does not have permission to write to the GitHub repository. If you want to enable this feature, please contact your GitHub admin to grant permission.";
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
	const { owner, repo, sourceBranchName } = req.body;
	const newBranchName: string = req.body.newBranchName;
	const logger = getLogger("github-create-branch-options-get", {
		fields: req.log?.fields
	});

	if (!owner || !repo || !sourceBranchName || !newBranchName) {
		logger.warn("Missing required data.");
		res.status(400).json({ error: getErrorMessages(400) });
		return;
	}

	try {
		const subscription = await Subscription.findForRepoOwner(owner, jiraHost, !!gitHubAppConfig.gitHubAppId);

		if (!subscription) {
			logger.error(Errors.MISSING_SUBSCRIPTION);
			throw Error(Errors.MISSING_SUBSCRIPTION);
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
		await sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchSuccessTrackEventName, jiraHost);
		const tags = {
			name: newBranchName,
			gitHubProduct: getCloudOrServerFromGitHubAppId(gitHubAppConfig.githubAppId)
		};
		statsd.increment(metricCreateBranch.created, tags, { jiraHost });
	} catch (e: unknown) {
		const err = e as { status?: number };
		if (err.status === undefined) {
			logger.error({ err }, "Error creating branch no status");
			err.status = 500;
		}

		logger.error({ err }, getErrorMessages(err.status));
		res.status(err.status).json({ error: getErrorMessages(err.status) });
		await sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchErrorTrackEventName, jiraHost);
		statsd.increment(metricCreateBranch.failed, {
			name: newBranchName
		}, { jiraHost });
	}
};

const sendTrackEventAnalytics = async (name: string, jiraHost: string) => {
	await sendAnalytics(jiraHost, AnalyticsEventTypes.TrackEvent, {
		action: name,
		actionSubject: name,
		source: AnalyticsTrackSource.CreateBranch
	}, {
		jiraHost
	});
};
