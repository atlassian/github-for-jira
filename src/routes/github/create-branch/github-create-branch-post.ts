import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";

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
	} catch (err) {
		req.log.error({ err }, "Error creating branch");
		res.status(500).json(verifyError(err));
	}
};

const verifyError = (error) => {
	switch (error.status) {
		case 403:
			// TODO: Fix the url later, once you figure out how to get the `installationId`
			return ["This GitHub repository hasn't been configured to your Jira site. <a href='#'>Allow access to this repository.</a>"];
		case 422:
			return ["This GitHub branch already exists. Please use a different branch name."];
		case 404:
			return ["This GitHub source branch does not exist. Please use a different branch."];
		default:
			return [error.message];
	}
};