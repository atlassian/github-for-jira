/**
 * Generates a create pull request link for GH in the format [URL]/compare/[name]?title=[...keys]-[name]
 * This format allows the use of title query param to set the PR name
 */
export const generateCreatePullRequestUrl = (baseUrl: string, name: string, issueKeys: string[] | null) => {
	// Remove duplicate keys
	const uniqueIssueKeys: string[] = [...new Set(issueKeys)];
	let title: string | undefined = uniqueIssueKeys?.join(" ");

	// Only prepend issue keys if they exist
	if (title) {
		title = encodeURIComponent(`${title} - ${name}`);
	} else {
		title = encodeURIComponent(`${name}`);
	}
	return  `${baseUrl}/compare/${name}?title=${title}`;
}