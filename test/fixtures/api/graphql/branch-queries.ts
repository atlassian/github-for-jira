import { getBranchesQueryWithChangedFiles } from "~/src/github/client/github-queries";

export const branchesNoLastCursor = {
	query: getBranchesQueryWithChangedFiles,
	variables: { owner: "integrations", repo: "test-repo-name", per_page: 20 }
};
