import Logger from "bunyan";
import { AxiosResponse } from "axios";
import { GitHubClient, GitHubConfig } from "./github-client";

export interface CreatedGitHubAppResponse {
	id: number;
	name: string;
	client_id: string;
	client_secret: string;
	webhook_secret: string;
	pem: string;
}

/**
 * A GitHub client without any authentication
 */
export class GitHubAnonymousClient extends GitHubClient {
	constructor(githubConfig: GitHubConfig, logger?: Logger) {
		super(githubConfig, logger);
	}

	public getMainPage(timeoutMs: number): Promise<AxiosResponse> {
		return this.axios.get(this.baseUrl, { timeout: timeoutMs });
	}

	public async createGitHubApp(code: string): Promise<CreatedGitHubAppResponse> {
		const apiUrl = `/app-manifests/${code}/conversions`;
		return (await this.axios.post(apiUrl, {}, { headers: { Accept: "application/vnd.github.v3+json" } })).data as CreatedGitHubAppResponse;
	}
}
