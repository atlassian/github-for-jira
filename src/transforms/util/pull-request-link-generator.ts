import { jiraIssueKeyParser } from "utils/jira-utils";

/**
 * Generates a create pull request link for GH in the format [URL]/compare/[name]?title=[...keys]-[name]
 * This format allows the use of title query param to set the PR name
 * Max length: 2000
 */
export const generateCreatePullRequestUrl = (baseUrl: string, branchName: string, issueKeys: string[] = []) => {
	const branchKeys = jiraIssueKeyParser(branchName);

	let keys = "";
	if (!branchKeys.length) {
		keys = issueKeys.length ? issueKeys[0] : "";
	}

	const title = encodeURIComponent(keys != "" ? keys + "-" + branchName : branchName);
	const branch = encodeURIComponent(branchName);
	const url = `${baseUrl}/compare/${branch}?title=${title}&quick_pull=1`;

	// Jira API has a 2000 character limit for createPullRequestUrl field.
	if (url.length > 2000) {
		return `${baseUrl}/compare/${branch}`;
	}

	return url;
};
