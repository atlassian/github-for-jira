import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";

declare const transformedRepositoryId: unique symbol;

export type TransformedRepositoryId = string & { [transformedRepositoryId]: never };

const calculatePrefix = (url: string) => {
	const parsedUrl = new URL(url);

	// - "1024" is the limit for repo id in Jira API, see
	// https://developer.atlassian.com/cloud/jira/software/rest/api-group-development-information/#api-group-development-information ,
	// therefore limiting to 512 (half of the limit).
	// - Not base64 to avoid handling of special symbols (+/=) that are not allowed in Jira API.
	// - Not "hostname", but "host" in case different ports serving different GHES
	// - Including "pathname" in case there's a reverse-proxy that does routing to different GHES based on path
	// - Removing special characters to smooth quirks like "myserver.com/blah/" and "myserver.com/blah"
	// - Using parsed url to remove protocol (in case the server available via both HTTP and HTTPS) and query params
	const prefix = Buffer.from(
		(parsedUrl.host + parsedUrl.pathname).toLowerCase().replace(/[\W_]/g, "")
	).toString("hex").substring(0, 512);

	return prefix;
};

/**
 * This is a temporary solution until we have a globally unique UUIDs across the globe (cloud repos, GHE server
 * repos etc.). Once we have it, we should rather use it instead.
 *
 * @param repositoryId
 * @param gitHubBaseUrl - can be undefined for Cloud
 */
export const transformRepositoryId = (repositoryId: number, gitHubBaseUrl?: string): TransformedRepositoryId => {
	if (!gitHubBaseUrl || calculatePrefix(gitHubBaseUrl) === calculatePrefix(GITHUB_CLOUD_BASEURL)) {
		return (repositoryId?.toString() || "undefined") as TransformedRepositoryId;
	}

	return `${calculatePrefix(gitHubBaseUrl)}-${repositoryId}` as TransformedRepositoryId;
};

export const reverseCalculatePrefix = (hash: string): string => {
	// Decoding the hex string to get the original prefix
	return Buffer.from(hash, "hex").toString();
};
