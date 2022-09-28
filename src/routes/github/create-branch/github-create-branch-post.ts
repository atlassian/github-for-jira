import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";

const errorMessages = {
	// TODO: Fix the url later, once you figure out how to get the `installationId`
	403: ["This GitHub repository hasn't been configured to your Jira site. <a href='#'>Allow access to this repository.</a>"],
	400: ["Missing information, please check if the values for owner, repository, source branch name and the new branch name are valid."],
	422: ["This GitHub branch already exists. Please use a different branch name.", "The Github Branch name is not valid."],
	404: ["This GitHub source branch does not exist. Please use a different branch."],
	500: ["Oops, something unexpected happened."]
};

// Errors need to be returned as an array
export const GithubCreateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost } = res.locals;
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
		// TODO - pass in the gitHubAppId when we start supporting GHES, instead of undefined
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, undefined);
		const baseBranchSha = (await gitHubUserClient.getReference(owner, repo, sourceBranchName)).data.object.sha;

		await gitHubUserClient.createReference(owner, repo, {
			owner,
			repo,
			ref: `refs/heads/${newBranchName}`,
			sha: baseBranchSha
		});
		res.sendStatus(200);
		sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchSuccessTrackEventName, jiraHost);
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.status(err.status).json(errorMessages[err?.status || 500]);
		sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchErrorTrackEventName, jiraHost);
	}
};

const sendTrackEventAnalytics = (name: string, jiraHost: string) => {
	sendAnalytics(AnalyticsEventTypes.TrackEvent, {
		name,
		jiraHost
	});
};
