import { GitHubAPI } from "probot";
import { getLogger } from "../../config/logger";
import { getPullRequestReviews } from "../../sync/queries";
import { PageInfo } from "./commit";

const logger = getLogger("services.github.pullrequestreviews");

export const getGithubPullRequestReviews = async (github: GitHubAPI, params: PullRequestReviewsParams): Promise<PullRequestReviews> => {
	try {
		return paginate(github, params);
	} catch (err) {
		logger.error({ err, params }, "Pull Request Review GraphQL Error");
		return Promise.reject();
	}
};

const paginate = async (github: GitHubAPI, params: PullRequestReviewsParams, reviews?: PullRequestReviews): Promise<PullRequestReviews> => {
	const response = (await github.graphql(getPullRequestReviews, {
		owner: params.owner,
		repo: params.repoName,
		pullRequestNumber: params.pullRequestNumber,
		cursor: params.cursor
	})) as PullRequestReviewResponse;
	if (reviews) {
		reviews?.edges?.push(...response.repository.pullRequest.reviews.edges);
	} else {
		reviews = response.repository.pullRequest.reviews;
	}
	if (reviews?.edges?.length >= reviews?.totalCount) {
		return reviews;
	}
	return paginate(github, { ...params, cursor: reviews.edges[reviews.edges.length - 1].cursor }, reviews);
};

interface PullRequestReviewResponse {
	repository: {
		pullRequest: {
			reviews: PullRequestReviews
		}
	};
}

export interface PullRequestReviews extends PageInfo {
	totalCount: number;
	edges: {
		cursor: string;
		node: PullRequestReview
	}[];
}

export interface PullRequestReview {
	body: string;
	state: string;
	author: {
		login: string;
		avatarUrl: string;
		email: string;
		name: string;
		url: string;
	};
	authoredDate: string;
	url: string;
}

export interface GithubCommitFile {
	path: string;
	object: {
		commitResourcePath: string;
	};
}

interface PullRequestReviewsParams {
	owner: string;
	repoName: string;
	pullRequestNumber: number;
	cursor?: string;
}
