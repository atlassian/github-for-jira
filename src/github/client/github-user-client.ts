import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { handleFailedRequest, instrumentFailedRequest, instrumentRequest, setRequestStartTime, setRequestTimeout } from "./github-client-interceptors";
import { metricHttpRequest } from "config/metric-names";
import { urlParamsMiddleware } from "utils/axios/url-params-middleware";
import { GITHUB_ACCEPT_HEADER } from "utils/get-github-client-config";
import { CreateReferenceBody } from "~/src/github/client/github-client.types";
import { GitHubClient, GitHubConfig } from "./github-client";
import {
	GetRepositoriesQuery,
	GetRepositoriesResponse, SearchedRepositoriesResponse,
	UserOrganizationsQuery,
	UserOrganizationsResponse
} from "~/src/github/client/github-queries";

/**
 * A GitHub client that supports authentication as a GitHub User.
 */
export class GitHubUserClient extends GitHubClient {
	private readonly userToken: string;

	constructor(userToken: string, githubConfig: GitHubConfig, logger?: Logger) {
		super(githubConfig, logger);
		this.userToken = userToken;

		this.axios.interceptors.request.use((config: AxiosRequestConfig) => {
			return {
				...config,
				headers: {
					...config.headers,
					Accept: GITHUB_ACCEPT_HEADER,
					Authorization: `token ${this.userToken}`
					// Authorization: `Bearer ${this.userToken}`
				}
			};
		});
		this.axios.interceptors.request.use(setRequestStartTime);
		this.axios.interceptors.request.use(setRequestTimeout);
		this.axios.interceptors.request.use(urlParamsMiddleware);

		this.axios.interceptors.response.use(
			undefined,
			handleFailedRequest(this.logger)
		);

		this.axios.interceptors.response.use(
			instrumentRequest(metricHttpRequest.github, this.restApiUrl),
			instrumentFailedRequest(metricHttpRequest.github, this.restApiUrl)
		);
	}

	private async get<T>(url, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
		return this.axios.get<T>(url, config);
	}

	private async post<T>(url, body = {}, params = {}, urlParams = {}): Promise<AxiosResponse<T>> {
		return this.axios.post<T>(url, body, {
			params,
			urlParams
		});
	}

	public async getUser(): Promise<AxiosResponse<Octokit.UsersGetAuthenticatedResponse>> {
		return await this.get<Octokit.UsersGetAuthenticatedResponse>("/user");
	}

	public async getUserRepositories(per_page = 20, cursor?: string): Promise<GetRepositoriesResponse> {
		try {
			const response = await this.graphql<GetRepositoriesResponse>(GetRepositoriesQuery, {}, {
				per_page,
				cursor
			});
			return response.data.data;
		} catch (err) {
			this.logger.error({ err }, "Could not fetch repositories");
			throw err;
		}
	}

	public async getUserOrganizations(first = 10): Promise<UserOrganizationsResponse> {
		try {
			const response = await this.graphql<UserOrganizationsResponse>(UserOrganizationsQuery, {}, {
				first
			});
			return response.data.data;
		} catch (err) {
			this.logger.error({ err }, "Could not fetch organizations");
			throw err;
		}
	}

	public getMembershipForOrg = async (org: string): Promise<AxiosResponse<Octokit.OrgsGetMembershipResponse>> => {
		return await this.get<Octokit.OrgsGetMembershipResponse>(`/user/memberships/orgs/{org}`, {
			urlParams: {
				org
			}
		});
	};

	public async getInstallations(): Promise<AxiosResponse<Octokit.AppsListInstallationsForAuthenticatedUserResponse>> {
		return await this.get<Octokit.AppsListInstallationsForAuthenticatedUserResponse>("/user/installations");
	}

	public async getReference(owner: string, repo: string, branch: string): Promise<AxiosResponse<Octokit.GitGetRefResponse>> {
		return await this.get<Octokit.GitGetRefResponse>(`/repos/{owner}/{repo}/git/refs/heads/{branch}`, {
			urlParams: {
				owner,
				repo,
				branch
			}
		});
	}

	public async createReference(owner: string, repo: string, body: CreateReferenceBody): Promise<AxiosResponse<Octokit.GitCreateRefResponse>> {
		return await this.post<Octokit.GitCreateRefResponse>(`/repos/{owner}/{repo}/git/refs`, body, {},
			{
				owner,
				repo
			});
	}

	public async getReferences(owner: string, repo: string, per_page = 100): Promise<AxiosResponse<Octokit.ReposGetBranchResponse[]>> {
		return await this.get<Octokit.ReposGetBranchResponse[]>(`/repos/{owner}/{repo}/branches?per_page={per_page}`, {
			urlParams: {
				owner,
				repo,
				per_page
			}
		});
	}

	public async getRepository(owner: string, repo: string): Promise<AxiosResponse<Octokit.ReposGetResponseSource>> {
		return await this.get<Octokit.ReposGetResponseSource>(`/repos/{owner}/{repo}`, {
			urlParams: {
				owner,
				repo
			}
		});
	}

	public async searchRepositories(queryString: string, order = "updated"): Promise<AxiosResponse<SearchedRepositoriesResponse>> {
		return await this.get<SearchedRepositoriesResponse>(`search/repositories?q={queryString}`, {
			urlParams: {
				queryString,
				order
			}
		});
	}

}
