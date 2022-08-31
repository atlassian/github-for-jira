import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";

export const GithubCreateBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppId } = res.locals;
	const { owner, repo, branch, newBranch  } = req.body;
	// req.body hsould have org, repo, new branch name

	if (!githubToken || !jiraHost) {
		res.sendStatus(401);
		return;
	}

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppId);
		const { data: baseBranchRef }  = await gitHubUserClient.getReference(owner, repo, branch);
		const sha = baseBranchRef.object.sha;
		await gitHubUserClient.createBranch(owner, repo, {
			"ref":`refs/heads/${newBranch}`,
			sha
		});
		// https://docs.github.com/en/rest/git/refs#create-a-reference
		res.sendStatus(200);
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.sendStatus(500);
	}
};
