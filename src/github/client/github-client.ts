import { Octokit } from "@octokit/rest";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import AppTokenHolder from "./app-token-holder";
import InstallationTokenCache from "./installation-token-cache";
import AuthToken from "./auth-token";
import { GetPullRequestParams } from "./types";

/**
 * A GitHub client that supports authentication as a GitHub app.
 *
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps
 */
export default class GitHubClient {

	private readonly axios: AxiosInstance;
	private readonly appTokenHolder: AppTokenHolder;
	private readonly installationTokenCache: InstallationTokenCache;
	private readonly githubInstallationId: number;

	constructor(
		githubInstallationId: number,
		baseURL = "https://api.github.com"
	) {
		this.axios = axios.create({
			baseURL
		});
		this.appTokenHolder = new AppTokenHolder();
		this.installationTokenCache = new InstallationTokenCache(1000);
		this.githubInstallationId = githubInstallationId;
	}

	/**
	 * Use this config in a request to authenticate with the app token.
	 */
	private appAuthenticationHeaders(): Partial<AxiosRequestConfig> {
		const appToken = this.appTokenHolder.getAppToken();
		return {
			headers: {
				Accept: "application/vnd.github.v3+json",
				Authorization: `Bearer ${appToken.token}`
			}
		}
	}

	/**
	 * Use this config in a request to authenticate with an installation token for the githubInstallationId.
	 */
	private async installationAuthenticationHeaders(): Promise<Partial<AxiosRequestConfig>> {
		const installationToken = await this.installationTokenCache.getInstallationToken(
			this.githubInstallationId,
			() => this.createInstallationToken(this.githubInstallationId));
		return {
			headers: {
				Accept: "application/vnd.github.v3+json",
				Authorization: `Bearer ${installationToken.token}`
			}
		}
	}

	/**
	 * Calls the GitHub API in the name of the GitHub app to generate a token that in turn can be used to call the GitHub
	 * API in the name of an installation of that app (to access the users' data).
	 */
	private async createInstallationToken(githubInstallationId: number): Promise<AuthToken> {
		const response = await this.axios.post<Octokit.AppsCreateInstallationTokenResponse>(`/app/installations/${githubInstallationId}/access_tokens`, {}, {
			...this.appAuthenticationHeaders()
		});
		const tokenResponse: Octokit.AppsCreateInstallationTokenResponse = response.data;
		return new AuthToken(tokenResponse.token, new Date(tokenResponse.expires_at));
	}

	private async get<T>(url, params = {}): Promise<AxiosResponse<T>> {
		const response = await this.axios.get<T>(url, {
			...await this.installationAuthenticationHeaders(),
			params: { 
				installationId: this.githubInstallationId,
				...params
			}
		});
		//TODO: error handling
		return response;
	}

	/**
	 * Lists pull requests for the given repository.
	 */
	public async getPullRequests(owner:string, repo: string, pullRequestParams: GetPullRequestParams): Promise<AxiosResponse<Octokit.PullsListResponseItem[]>> {
		return await this.get<Octokit.PullsListResponseItem[]>(`/repos/${owner}/${repo}/pulls`, pullRequestParams);
	}

	/**
	 * Get a single pull request for the given repository.
	 */
	public async getPullRequest(owner: string, repo: string, pullNumber: string): Promise<AxiosResponse<Octokit.PullsGetResponse>> {
		return await this.get<Octokit.PullsGetResponse>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
	}

	/**
	 * Get publicly available information for user with given username.
	 */
	public getUserByUsername = async (username: string): Promise<AxiosResponse<Octokit.UsersGetByUsernameResponse>> => {
		return await this.get<Octokit.UsersGetByUsernameResponse>(`/users/${username}`);
	}

}
