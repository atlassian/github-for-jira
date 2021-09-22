import { GitHubAPI } from "probot";
import { getLogger } from "../../config/logger";
import { getDefaultRef } from "../../sync/queries";

const logger = getLogger("services.github.branches");

export const getGithubDefaultBranch = async (github: GitHubAPI, params: DefaultBranchParam): Promise<string> => {
	try {
		const response = (await github.graphql(getDefaultRef, {
			owner: params.owner,
			repo: params.repoName
		})) as DefaultBranchResponse;
		return response.repository.defaultBranchRef?.name || "main";
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
