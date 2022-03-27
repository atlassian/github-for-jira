/**
 * Generates a create pull request link for GH in the format [URL]/compare/[name]?title=[...keys]-[name]
 * This format allows the use of title query param to set the PR name
 */
export const generateCreatePullRequestUrl = (baseUrl: string, name: string, issueKeys: string[] = []) => {
	const keys = issueKeys?.length ? `${issueKeys.join(" ")} - ` : "";
	const title = encodeURIComponent(keys + name);
	const branchName = encodeURIComponent(name);
	const url = `${baseUrl}/compare/${branchName}?title=${title}&quick_pull=1`;
	return url;
};
