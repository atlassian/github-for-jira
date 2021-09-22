import { GitHubAPI } from "probot";
import { getLogger } from "../../config/logger";
import { getCommits as getCommitsQuery } from "../../sync/queries";

const logger = getLogger("services.github.commits");

export const getSpecificGithubCommits = async (github: GitHubAPI, params: SpecificCommitParams): Promise<GithubCommit[]> => {
	if (!params.commitRefs?.length) {
		return [];
	}

	try {
		const response = (await github.graphql(
			`query ($owner: String!, $repo: String!) {
  commits: repository(owner: $owner, name: $repo) {
  ${params.commitRefs.map((oid, index) => `
  _c${index}: object(oid: "${oid}") {
      ... on Commit {
        abbreviatedOid
        oid
        message
        author {
          avatarUrl
          email
          name
          user {
            url
          }
        }
        authoredDate
        url
        changedFiles
        parents {
          totalCount
        }
      }
    }`)}
  }
}`, {
				owner: params.owner,
				repo: params.repoName
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			})) as SpecificCommitResponse;
		return response.commits ? Object.values(response.commits) : [];
	} catch (err) {
		logger.error({ err, params }, "Specific Commit GraphQL Error");
		return Promise.reject();
	}
};


export const getGithubCommits = async (github: GitHubAPI, params: CommitParams): Promise<GithubCommitNode[]> => {
	try {
		const response = (await github.graphql(getCommitsQuery, {
			owner: params.owner,
			repo: params.repoName,
			default_ref: params.branchName,
			cursor: params.cursor
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		})) as CommitResponse;
		return response.repository.ref?.target.history.edges || [];
	} catch (err) {
		logger.error({ err, params }, "Commits GraphQL Error");
		return Promise.reject();
	}
};

interface SpecificCommitResponse {
	commits: Record<string, GithubCommit>;
}

interface CommitResponse {
	repository: {
		ref?: {
			target: {
				history: {
					totalCount: number;
					edges?: GithubCommitNode[]
				} & PageInfo
			}
		}
	};
}

export interface PageInfo {
	pageInfo: {
		hasNextPage: boolean;
		startCursor: string;
		endCursor: string
	};
}

export interface GithubCommitNode {
	cursor: string;
	node: GithubCommit;
}

export interface GithubCommit {
	oid: string;
	abbreviatedOid: string;
	message: string;
	authoredDate: string;
	url: string;
	changedFiles: number;
	author: {
		avatarUrl: string;
		email: string;
		name: string;
		user: {
			url: string;
		}
	};
	parents: {
		totalCount: number;
	};
}

export interface GithubCommitFile {
	path: string;
	object: {
		commitResourcePath: string;
	};
}

interface CommitParams {
	owner: string;
	repoName: string;
	branchName: string;
	cursor?: string;
}

interface SpecificCommitParams {
	owner: string;
	repoName: string;
	commitRefs: string[];
}
