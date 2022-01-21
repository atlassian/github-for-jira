import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import AppTokenHolder from "./app-token-holder";
import InstallationTokenCache from "./installation-token-cache";
import AuthToken from "./auth-token";
import { GetPullRequestParams } from "./types";
import { handleFailedRequest, instrumentFailedRequest, instrumentRequest, setRequestStartTime } from "./interceptors";
import { metricHttpRequest } from "../../config/metric-names";
import { getLogger } from "../../config/logger";
import { InstallationId } from "./installation-id";
import {GetBranchesQuery, GetBranchesResponse, ViewerRepositoryCountQuery} from "./github-queries";

/**
 * The response type for GitHub GraphQL calls.
 * Was copied from @octokit/graphql to avoid adding a dependency on Octokit Graphql client
 */
declare type GraphQlQueryResponse<ResponseData> = {
	data: ResponseData;
	errors?: [
		{
			message: string;
			path: [string];
			extensions: {
				[key: string]: any;
			};
			locations: [
				{
					line: number;
					column: number;
				}
			];
		}
	];
};


/**
 * A GitHub client that supports authentication as a GitHub app.
 *
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps
 */
export default class GitHubClient {
	private readonly axios: AxiosInstance;
	private readonly appTokenHolder: AppTokenHolder;
	private readonly installationTokenCache: InstallationTokenCache;
	private readonly githubInstallationId: InstallationId;
	private readonly logger: Logger;

	constructor(
		githubInstallationId: InstallationId,
		logger: Logger,
		appTokenHolder: AppTokenHolder = AppTokenHolder.getInstance()
	) {
		this.logger = logger || getLogger("github.client.axios");
		this.axios = axios.create({
			baseURL: githubInstallationId.githubBaseUrl
		});
		this.axios.interceptors.request.use(setRequestStartTime);
		this.axios.interceptors.response.use(
			undefined,
			handleFailedRequest(this.logger)
		);
		this.axios.interceptors.response.use(
			instrumentRequest(metricHttpRequest.github),
			instrumentFailedRequest(metricHttpRequest.github)
		);
		this.appTokenHolder = appTokenHolder;
		this.installationTokenCache = InstallationTokenCache.getInstance();
		this.githubInstallationId = githubInstallationId;
	}

	/**
	 * Use this config in a request to authenticate with the app token.
	 */
	private appAuthenticationHeaders(): Partial<AxiosRequestConfig> {
		const appToken = this.appTokenHolder.getAppToken(this.githubInstallationId);
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
			this.githubInstallationId.installationId,
			() => this.createInstallationToken(this.githubInstallationId.installationId));
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
			params
		});
		return response;
	}

	private async graphql<T>(query: string, variables?: Record<string, string | number | undefined>): Promise<AxiosResponse<GraphQlQueryResponse<T>>> {
		return  await this.axios.post<GraphQlQueryResponse<T>>("https://api.github.com/graphql",
			{
				query,
				variables
			},
			{
				...await this.installationAuthenticationHeaders(),
			});
	}

	/**
	 * Lists pull requests for the given repository.
	 */
	public async getPullRequests(owner: string, repo: string, pullRequestParams: GetPullRequestParams): Promise<AxiosResponse<Octokit.PullsListResponseItem[]>> {
		return this.get<Octokit.PullsListResponseItem[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, pullRequestParams);
	}

	/**
	 * Get a single pull request for the given repository.
	 */
	// TODO: add a unit test
	public async getPullRequest(owner: string, repo: string, pullNumber: string): Promise<AxiosResponse<Octokit.PullsGetResponse>> {
		return  this.get<Octokit.PullsGetResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`);
	}

	/**
	 * Get publicly available information for user with given username.
	 */
	// TODO: add a unit test
	public getUserByUsername = async (username: string): Promise<AxiosResponse<Octokit.UsersGetByUsernameResponse>> => {
		return this.get<Octokit.UsersGetByUsernameResponse>(`/users/${encodeURIComponent(username)}`);
	}

	/**
	 * Get a single commit for the given repository.
	 */
	public async getCommit(owner: string, repo: string, ref: string): Promise<AxiosResponse<Octokit.ReposGetCommitResponse>> {
		return this.get<Octokit.ReposGetCommitResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`);
	}
		
	public async getNumberOfReposForInstallation(): Promise<number> {
		const response = await this.graphql<{viewer: {repositories: {totalCount: number}}}>(ViewerRepositoryCountQuery);

		return response?.data?.data?.viewer?.repositories?.totalCount;
	}


	public async getBranchesPage(owner: string, repoName: string, perPage?: number, cursor?: string) : Promise<GetBranchesResponse> {
		const response = await this.graphql<GetBranchesResponse>(GetBranchesQuery,
			{
				owner: owner,
				repo: repoName,
				per_page: perPage,
				cursor
			});
		return response?.data?.data;
	}

}
