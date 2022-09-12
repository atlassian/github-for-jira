import { Request, Response } from "express";
import { createUserClient } from "~/src/util/get-github-client-config";

export const GithubBranchesGet = async (req: Request, res: Response): Promise<void> => {
	const { githubToken, jiraHost, gitHubAppConfig } = res.locals;

	if (!githubToken || !jiraHost || !gitHubAppConfig) {
		res.sendStatus(401);
		return;
	}

	const { owner, repo } = req.params;
	if (!owner || !repo) {
		res.status(400).json({ err: "Missing required data." });
		return;
	}

	try {
		const gitHubUserClient = await createUserClient(githubToken, jiraHost, req.log, gitHubAppConfig.gitHubAppId);
		let allBranchesFetched = false;
		let allBranches;
		let cursor;
		while (!allBranchesFetched) {
			const response = await gitHubUserClient.getBranches(owner, repo, 100, cursor);
			if (allBranches) {
				allBranches.repository.refs.edges = allBranches.repository.refs.edges.concat(response.repository.refs.edges);
			} else {
				allBranches = response;
			}
			cursor = allBranches.repository.refs.edges[allBranches.repository.refs.edges.length - 1].cursor;
			if (allBranches.repository.refs.edges.length >= response.repository.refs.totalCount) {
				allBranchesFetched = true;
			}
		}
		res.send(allBranches);
	} catch (err) {
		req.log.error({ err }, "Error while fetching branches");
		res.sendStatus(500);
	}
};
