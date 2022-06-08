import { getCommitsQueryWithChangedFiles } from "~/src/github/client/github-queries";

export const commitsNoLastCursor = (variables) => ({
	query: getCommitsQueryWithChangedFiles,
	variables
});

export const commitsWithLastCursor = {
	query: getCommitsQueryWithChangedFiles,
	variables: {
		owner: "integrations",
		repo: "test-repo-name",
		per_page: 20,
		cursor: "Y3Vyc29yOnYyOpK5MjAxsdlkwOC0yM1QxNzozODowNS0wNDowMM4MjT7J 99",
		default_ref: "master"
	}
};

const defaultBranchQuery = `query ($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
        defaultBranchRef {
          name
        }
    }
  }`;

export const getDefaultBranch = {
	query: defaultBranchQuery,
	variables: {
		owner: "integrations",
		repo: "test-repo-name"
	}
};
