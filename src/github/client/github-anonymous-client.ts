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

	public async exchangeGitHubToken(opts: {
		clientId: string,
		clientSecret: string,
		code: string,
		state: string
	}) {
		const { data: { access_token: accessToken, refresh_token: refreshToken } } = await this.axios.get(`/login/oauth/access_token`,
			{
				baseURL: this.baseUrl,
				params: {
					client_id: opts.clientId,
					client_secret: opts.clientSecret,
					code: opts.code,
					state: opts.state
				},
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				},
				responseType: "json"
			}
		);
		return {
			accessToken,
			refreshToken
		};
	}

	public async checkGitHubToken(gitHubToken: string) {
		await this.axios.get("", {
			headers: {
				Authorization: `Bearer ${gitHubToken}`
			}
		});
	}

	public async renewGitHubToken(opts: {
		refreshToken: string,
		clientId: string,
		clientSecret: string
	}) {
		const { data: { access_token: accessToken, refresh_token: refreshToken } } = await this.axios.post(`/login/oauth/access_token`,
			{
				refresh_token: opts.refreshToken,
				grant_type: "refresh_token",
				client_id: opts.clientId,
				client_secret: opts.clientSecret
			},{
				baseURL: this.baseUrl,
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				},
				responseType: "json"
			}
		);
		return {
			accessToken,
			refreshToken
		};
	}

}
