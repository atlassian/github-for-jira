import transformCommit from "../transforms/commit";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import { getGithubCommits } from "../services/github/commit";
import { getGithubDefaultBranch } from "../services/github/branches";


// TODO: better typings
export default async (github: GitHubAPI, repository: Repository, cursor?: string) => {
	const refName = await getGithubDefaultBranch(github, {
		owner: repository.owner.login,
		repoName: repository.name
	});

	const commitsData = await getGithubCommits(github, {
		owner: repository.owner.login,
		repoName: repository.name,
		branchName: refName,
		cursor
	});

	// if the repository is empty, commitsData.repository.ref is null
	const commits = commitsData?.map(edge => edge.node);

	return {
		edges: commitsData,
		jiraPayload: transformCommit({ commits, repository })
	};
};
