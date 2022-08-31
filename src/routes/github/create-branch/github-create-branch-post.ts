import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";

export const GithubCreateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppId } = res.locals;

	// req.body hsould have org, repo, new branch name

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppId);
		await gitHubUserClient.createBranch("ORG GOES HERE", "REPO NAME", {});
		// https://docs.github.com/en/rest/git/refs#create-a-reference
		res.sendStatus(200);
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.sendStatus(500);
	}
};
