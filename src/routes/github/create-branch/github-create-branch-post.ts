import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { statsd } from "~/src/config/statsd";
import { metricCreateBranch } from "~/src/config/metric-names";
import { getCloudOrServerFromGitHubAppId } from "~/src/util/get-cloud-or-server";
import { Subscription } from "models/subscription";

/**
 * Returns the URL for Installation settings page in GitHub
 *
 * @param userLogin
 * @param hostname
 * @param jiraHost
 * @param repoOwner
 * @param repoName
 */
const getGitHubConfigurationLink = async (
	userLogin: string,
	jiraHost: string,
	hostname: string,
	repoOwner: string,
	repoName: string
) => {
	// URL for the app configuration for different repoOwners/organizations in GitHub, used during 403 errors
	let url = `${hostname}/organizations/${repoOwner}/settings/installations/`;

	// If the repoOwners/organizations is the same as the user's login, then the url is different
	if (userLogin === repoOwner) {
		url = `${hostname}/settings/installations/`;
	}

	const subscription = await Subscription.findForRepoNameAndOwner(repoName, repoOwner, jiraHost);

	return url + subscription?.gitHubInstallationId;
};

const getErrorMessages = (statusCode: number, url?: string): string => {
	switch (statusCode) {
		case 403: {
			return `We couldn’t create this branch, possibly because this GitHub repository hasn't been configured to your Jira site. <a href="${url}" target="_blank">Allow access to this repository.</a>`;
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
	const { githubToken, gitHubAppConfig, jiraHost } = res.locals;
	const { owner, repo, sourceBranchName, newBranchName } = req.body;

	if (!githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!owner || !repo || !sourceBranchName || !newBranchName) {
		res.status(400).json({ error: getErrorMessages(400) });
		return;
	}
	const gitHubUserClient = await createUserClient(githubToken, jiraHost, { trigger: "github-create-branch" }, req.log, gitHubAppConfig.gitHubAppId);

	try {
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

		if (err.status === 403) {
			const user = await gitHubUserClient.getUser();
			const gitHubConfigurationLink = await getGitHubConfigurationLink(user.data.login, jiraHost, gitHubAppConfig.hostname, owner, repo);
			res.status(err.status).json({ error: getErrorMessages(err.status, gitHubConfigurationLink) });
		} else {
			res.status(err.status).json({ error: getErrorMessages(err.status) });
		}
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
