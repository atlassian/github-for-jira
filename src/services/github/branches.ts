import { GitHubAPI } from "probot";
import { getLogger } from "../../config/logger";
import { getBranches as getBranchesQuery, getDefaultRef } from "../../sync/queries";
import { PageInfo } from "./commit";
import { PullRequest } from "./pull-requests";

const logger = getLogger("services.github.branches");

// TODO: need to reassess this to see if we should just grab the branch names, then the commits under those as a separate call
export const getGithubBranches = async (github: GitHubAPI, params: GithubBranchParam): Promise<GithubBranchNode[]> => {
	try {
		const response = await github.graphql(getBranchesQuery, {
			owner: params.owner,
			repo: params.repoName,
			cursor: params.cursor
		}) as GithubBranchesResponse;
		return response.repository.refs.edges;
	} catch (err) {
		logger.error({ err, params }, "Branches GraphQL Error");
		throw err;
	}
};

interface GithubBranchParam {
	owner: string;
	repoName: string;
	cursor?: string;
}

export interface GithubBranchesResponse {
	repository: {
		refs: {
			edges: GithubBranchNode[];
		}
	};
}

export interface GithubBranchNode {
	cursor: string;
	node: GithubBranch;
}

export interface GithubBranch {
	associatedPullRequests: {
		nodes: { title: string }[];
	};
	name: string;
	target: {
		oid: string;
		message: string;
		url: string;
		authoredDate: string;
		changedFiles: number;
		author: {
			avatarUrl: string;
			email: string;
			name: string;
		};
		history: {
			nodes: GithubBranchCommit[];
		}
	};
}

export interface GithubBranchCommit {
	message: string;
	oid: string;
	authoredDate: string;
	author: {
		avatarUrl: string;
		email: string;
		name: string;
		user: {
			url: string;
		}
	};
	url: string;
}

export interface Branches extends PageInfo {
	totalCount: number;
	edges: {
		cursor: string;
		node: PullRequest
	}[];
}

export const getGithubDefaultBranch = async (github: GitHubAPI, params: DefaultBranchParam): Promise<string> => {
	try {
		const response = (await github.graphql(getDefaultRef, {
			owner: params.owner,
			repo: params.repoName
		})) as DefaultBranchResponse;
		return response.repository.defaultBranchRef?.name || "master";
	} catch (err) {
		logger.error({ err, params }, "Pull Request GraphQL Error");
		throw err;
	}
};

interface DefaultBranchResponse {
	repository: {
		defaultBranchRef?: {
			name: string;
		}
	};
}

interface DefaultBranchParam {
	owner: string;
	repoName: string;
}
