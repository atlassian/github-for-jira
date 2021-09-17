import { GitHubAPI } from "probot";
import { getLogger } from "../../config/logger";
import { GraphQlQueryResponse } from "probot/lib/github";
import { getPullRequestReviews } from "../../sync/queries";

const logger = getLogger("services.github.commit");

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
		pullRequestNumber: params.pullRequestNumber
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	})) as PullRequestReviewResponse;
	reviews.edges.push(...response.data.repository.pullRequest.reviews.edges);
	if(reviews.edges.length >= reviews.totalCount) {
		return reviews;
	}
	return paginate(github, {...params, cursor: reviews.edges[reviews.edges.length - 1].cursor}, reviews);
};

interface PullRequestReviewResponse extends GraphQlQueryResponse {
	data: {
		repository: {
			pullRequest: {
				reviews: PullRequestReviews
			}
		}
	};
}

export interface PullRequestReviews {
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
