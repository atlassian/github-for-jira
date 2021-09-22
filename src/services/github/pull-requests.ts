import { GitHubAPI } from "probot";
import { getLogger } from "../../config/logger";
import { getPullRequests } from "../../sync/queries";
import { PageInfo } from "./commit";

const logger = getLogger("services.github.pullrequests");

export const getGithubPullRequests = async (github: GitHubAPI, params: PullRequestsParams): Promise<PullRequests> => {
	try {
		const response = (await github.graphql(getPullRequests, {
			owner: params.owner,
			repo: params.repoName,
			cursor: params.cursor
		})) as PullRequestResponse;
		return response.repository.pullRequests;
	} catch (err) {
		logger.error({ err, params }, "Pull Request GraphQL Error");
		throw err;
	}
};

interface PullRequestResponse {
	repository: {
		pullRequests: PullRequests
	};
}

export interface PullRequests extends PageInfo {
	totalCount: number;
	edges: {
		cursor: string;
		node: PullRequest
	}[];
}

export interface PullRequest {
	id: string;
	number: number;
	title: string;
	body: string;
	state: string;
	url: string;
	updatedAt: string;
	createdAt: string;
	merged: boolean;
	repository: {
		id: string;
		name: string;
		url: string;
	};
	author?: {
		login: string;
		avatarUrl: string;
		email: string;
		name: string;
		url: string;
	};
	baseRef?: {
		name: string;
	};
	headRef?: {
		name: string;
	};
	comments: {
		totalCount: number;
	};
}

interface PullRequestsParams {
	owner: string;
	repoName: string;
	cursor?: string;
}
