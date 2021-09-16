import { GitHubAPI } from "probot";
import { getLogger } from "../../config/logger";
import { GraphQlQueryResponse } from "probot/lib/github";

const logger = getLogger("services.github.commit");

export const getGithubCommits = async (github: GitHubAPI, params: CommitParams): Promise<Commit[]> => {
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
        tree {
          entries {
            path
            object {
              commitResourcePath
            }
          }
        }
      }
    }`)}
  }
}`, {
				owner: params.owner,
				repo: params.repoName
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			})) as CommitResponse;
		return Object.values(response.data.commits);
	} catch (err) {
		logger.error({ err, params }, "Commit GraphQL Error");
		return Promise.reject();
	}
};

interface CommitResponse extends GraphQlQueryResponse {
	data: {
		commits: {
			[oid: string]: Commit
		}
	};
}

interface Commit {
	oid: string;
	abbreviatedOid: string;
	message: string;
	author: {
		avatarUrl: string;
		email: string;
		name: string;
		user: {
			url: string;
		}
	};
	authoredDate: string;
	url: string;
	changedFiles: number;
	parents: {
		totalCount: number;
	};
	tree: {
		entries: GithubCommitFile[]
	};
}

export interface GithubCommitFile {
	path: string;
	object: {
		commitResourcePath: string;
	};
}

interface CommitParams {
	commitRefs: string[];
	owner: string;
	repoName: string;
}
