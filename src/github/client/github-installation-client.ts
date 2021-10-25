import { Octokit } from "@octokit/rest";
import HttpClient, { AuthToken } from "./http-client";
import LRUCache from "lru-cache";
import { AxiosRequestConfig } from "axios";
import GithubAppClient from "./github-app-client";

type Context = {
	now: () => Date;
	installationTokens: LRUCache<number, AuthToken>;
	githubAsAppClient: GithubAppClient
}

/**
 * A GitHub client that uses an "installation token" to authenticate with the GitHub API. An installation token provides
 * access to a GitHub org's API in the name of an installed GitHub app.
 *
 * The client stores the tokens for all installations in an least-recently-used (LRU) cache. If the token for an installation
 * has expired, it calls uses an GithubAppClient to generate a new token.
 *
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation
 */
export default class GithubInstallationClient extends HttpClient<Context> {

	constructor(
		githubAsAppClient: GithubAppClient,
		baseURL = "https://api.github.com",
		now: () => Date = () => new Date()
	) {
		super(baseURL, {
			now,
			installationTokens: new LRUCache<number, AuthToken>({ max: 1000 }),
			githubAsAppClient
		});
	}

	protected onRequest(context: Context): (config: AxiosRequestConfig) => Promise<AxiosRequestConfig> {
		return async function (config: AxiosRequestConfig) {
			const githubInstallationId = config.params.installationId;

			if (!githubInstallationId) {
				throw new Error("no githubInstallationId passed as param in AxiosRequestConfig!");
			}

			let token = context.installationTokens.get(githubInstallationId);

			if (!token || token.isAboutToExpire(context.now())) {
				token = await context.githubAsAppClient.createInstallationToken(githubInstallationId);
				context.installationTokens.set(githubInstallationId, token, token.millisUntilAboutToExpire(context.now()));
			}

			config.headers.Accept = "application/vnd.github.v3+json";
			config.headers.Authorization = `Bearer ${token.token}`;

			return config;
		};
	}

	async getPullRequests(
		githubInstallationId: number,
		owner: string,
		repo: string,
		pageSize: number,
		page: number): Promise<Octokit.PullsListResponseItem[]> {
		const response = await this.axios.get<Octokit.PullsListResponseItem[]>(`/repos/${owner}/${repo}/pulls`, {
			params: {
				installationId: githubInstallationId,
				per_page: pageSize,
				page: page
			}
		});

		return response.data;
	}

}
