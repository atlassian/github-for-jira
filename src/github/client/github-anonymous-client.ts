import Logger from "bunyan";
import { AxiosResponse } from "axios";
import { GitHubClient, GitHubConfig, Metrics } from "./github-client";
import { getLogger } from "config/logger";
import { ExchangeTokenResponse } from "~/src/rest-interfaces";

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
	constructor(githubConfig: GitHubConfig, jiraHost: string | undefined, metrics: Metrics, logger: Logger) {
		super(githubConfig, jiraHost, metrics, logger);
	}

	public getPage(timeoutMs: number, path = "", extraHeaders: { [name: string]: string } = {}): Promise<AxiosResponse> {
		return this.axios.get(this.baseUrl + path, { timeout: timeoutMs, headers: extraHeaders });
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
	}): Promise<ExchangeTokenResponse | undefined> {
		const axiosResponse = await this.axios.get(`/login/oauth/access_token`,
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

		const accessToken = axiosResponse.data.access_token as string;
		const refreshToken = axiosResponse.data.refresh_token as string | undefined;
		if (accessToken === undefined) {
			return undefined;
		}

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

	public async renewGitHubToken(refreshToken: string, clientId: string,	clientSecret: string): Promise<{ accessToken: string, refreshToken: string }> {
		const logger = getLogger("GitHubAnonymousClient");
		logger.info("GitHubAnonymousClient trying to renewGitHubToken");
		const res = await this.axios.post(`/login/oauth/access_token`,
			{
				refresh_token: refreshToken,
				grant_type: "refresh_token",
				client_id: clientId,
				client_secret: clientSecret
			},{
				baseURL: this.baseUrl,
				headers: {
					accept: "application/json",
					"content-type": "application/json"
				}
			}
		);

		// In case of invalid or expired refresh token, GitHub API returns status code 200 with res.data object contains error fields,
		// so adding check for presence of access token to make sure that new access token has been generated.
		if (!res.data?.access_token) {
			throw new Error(`Failed to renew access token ${res.data?.error as string}`);
		}
		return {
			accessToken: res.data.access_token,
			refreshToken: res.data.refresh_token
		};
	}

}
