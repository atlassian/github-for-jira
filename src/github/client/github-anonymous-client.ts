import Logger from "bunyan";
import { AxiosResponse } from "axios";
import { GitHubClient, GitHubConfig } from "./github-client";

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

}
