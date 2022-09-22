import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum } from "interfaces/common";

export const GithubCreateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost } = res.locals;
	const { owner, repo, sourceBranchName, newBranchName } = req.body;

	if (!githubToken) {
		res.sendStatus(401);
		return;
	}

	if (!owner || !repo || !sourceBranchName || !newBranchName) {
		res.status(400).json({ err: "Missing required data." });
		return;
	}

	try {
		// TODO - pass in the gitHubAppId when we start supporting GHES, instead of undefined
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, undefined);
		let baseBranchSha;
		try {
			baseBranchSha = (await gitHubUserClient.getReference(owner, repo, sourceBranchName)).data.object.sha;
		} catch (err) {
			if (err.status === 404) {
				res.status(400).json({ err: "Source branch not found" });
				return;
			} else {
				res.status(400).json({ err: "Error while fetching source branch details" });
				return;
			}
		}

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
		res.sendStatus(500);
		sendTrackEventAnalytics(AnalyticsTrackEventsEnum.CreateBranchErrorTrackEventName, jiraHost);
	}
};

const sendTrackEventAnalytics = (name: string, jiraHost: string) => {
	sendAnalytics(AnalyticsEventTypes.TrackEvent, {
		name,
		jiraHost
	});
};
