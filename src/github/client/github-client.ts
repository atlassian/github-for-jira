import {GITHUB_CLOUD_API_BASEURL} from "utils/get-github-client-config";

/**
 * A GitHub client superclass to encapsulate the attributes of the other GitHub
 * clients that differ.
 */
export class GitHubClient {
	private readonly baseUrl: string | undefined;

	constructor (baseUrl?: string) {
		this.baseUrl = baseUrl
	}

	public getGitHubBaseUrl() {
		return this.baseUrl ? this.baseUrl : GITHUB_CLOUD_API_BASEURL
	}
}
