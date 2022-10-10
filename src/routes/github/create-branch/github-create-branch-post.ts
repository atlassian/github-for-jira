import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";
import { statsd } from "~/src/config/statsd";
import { metricCreateBranch } from "~/src/config/metric-names";
import { getCloudOrServerFromGitHubAppId } from "~/src/util/get-cloud-or-server";

const errorMessages = {
	// TODO: Fix the url later, once you figure out how to get the `installationId`
	403: "We couldn’t create this branch, possibly because this GitHub repository hasn't been configured to your Jira site. <a href='#'>Allow access to this repository.</a>",
	400: "We couldn’t create this branch. Check that you’ve entered valid values for repository, source branch name, and new branch name.",
	422: "We couldn’t create this branch, possibly because:<ul>" +
		"<li>This GitHub branch already exists. Please try a different branch name.</li>" +
		"<li>The GitHub branch name is not valid.</li>" +
		"</ul>",
	404: "We couldn’t create this branch, possibly because the GitHub source branch you entered doesn't exist. Please try a different branch.",
	500: "We couldn’t create this branch because something went wrong. Please try again."
};

// Errors need to be returned as an array
export const GithubCreateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppConfig } = res.locals;
	const { owner, repo, sourceBranchName, newBranchName } = req.body;

	if (!githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!owner || !repo || !sourceBranchName || !newBranchName) {
		res.status(400).json(errorMessages[400]);
		return;
	}

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
		const baseBranchSha = (await gitHubUserClient.getReference(owner, repo, sourceBranchName)).data.object.sha;

		await gitHubUserClient.createReference(owner, repo, {
			owner,
			repo,
			ref: `refs/heads/${newBranchName}`,
			sha: baseBranchSha
		});
		res.sendStatus(200);
		sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchSuccessTrackEventName, jiraHost);
		const tags = {
			name: newBranchName,
			gitHubProduct: getCloudOrServerFromGitHubAppId(gitHubAppConfig.githubAppId)
		};
		statsd.increment(metricCreateBranch.created, tags);
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.status(err.status).json(errorMessages[err?.status || 500]);
		sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchErrorTrackEventName, jiraHost);
		statsd.increment(metricCreateBranch.failed, {
			name: newBranchName
		});

	}
};

const sendTrackEventAnalytics = (name: string, jiraHost: string) => {
	sendAnalytics(AnalyticsEventTypes.TrackEvent, {
		name,
		jiraHost
	});
};