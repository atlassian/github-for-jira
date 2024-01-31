import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { CreateReferenceBody } from "~/src/github/client/github-client.types";
import { GitHubClient, GitHubConfig, Metrics } from "./github-client";
import {
	GetRepositoriesQuery,
	GetRepositoriesResponse, SearchedRepositoriesResponse,
	UserOrganizationsQuery,
	UserOrganizationsResponse
} from "~/src/github/client/github-queries";
import { GITHUB_ACCEPT_HEADER } from "./github-client-constants";

/**
 * A GitHub client that supports authentication as a GitHub User.
 */
export class GitHubUserClient extends GitHubClient {
	private readonly userToken: string;

	constructor(userToken: string, gitHubConfig: GitHubConfig, jiraHost: string, metrics: Metrics, logger: Logger) {
		super(gitHubConfig, jiraHost, metrics, logger);
		this.userToken = userToken;

		this.axios.interceptors.request.use((config: AxiosRequestConfig) => {
			return {
				...config,
				headers: {
					...config.headers,
					Accept: GITHUB_ACCEPT_HEADER,
					Authorization: `token ${this.userToken}`
				}
			};
		});
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
			}, { graphQuery: "GetRepositoriesQuery" });
			return response.data.data;
		} catch (err: unknown) {
			this.logger.error({ err }, "Could not fetch repositories");
			throw err;
		}
	}

	public async getUserOrganizations(first = 10): Promise<UserOrganizationsResponse> {
		try {
			const response = await this.graphql<UserOrganizationsResponse>(UserOrganizationsQuery, {}, {
				first
			}, { graphQuery: "UserOrganizationsQuery" });
			return response.data.data;
		} catch (err: unknown) {
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
		return await this.get<Octokit.AppsListInstallationsForAuthenticatedUserResponse>("/user/installations?per_page=100");
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

	public async searchRepositories(queryString: string, order = "updated"): Promise<AxiosResponse<SearchedRepositoriesResponse>> {
		return await this.get<SearchedRepositoriesResponse>(`search/repositories?q={queryString}&order={order}`, {
			urlParams: {
				queryString,
				order
			}
		});
	}

}
