/**
 * Generates a create pull request link for GH in the format [URL]/compare/[name]?title=[...keys]-[name]
 * This format allows the use of title query param to set the PR name
 */
export const generateCreatePullRequestUrl = (baseUrl: string, name: string, issueKeys: null | string[] = []) => {
	const keys = issueKeys?.length ? `${issueKeys.join(" ")} - ` : "";
	const title = encodeURIComponent(keys + name);

	return  `${baseUrl}/compare/${name}?title=${title}`;
}