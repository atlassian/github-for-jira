import transformBranches from "./transforms/branch";
import { GitHubAPI } from "probot";
import { Repository } from "../models/subscription";
import { getGithubBranches } from "../services/github/branches";

// TODO: better typings
export default async (github: GitHubAPI, repository: Repository, cursor?: string) => {
	const edges = await getGithubBranches(github, {
		owner: repository.owner.login,
		repoName: repository.name,
		cursor
	});

	const branches = edges.map(edge => edge.node);

	return {
		edges,
		jiraPayload: transformBranches({ branches, repository })
	};
};
