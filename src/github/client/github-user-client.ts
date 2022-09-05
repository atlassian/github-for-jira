import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { handleFailedRequest, instrumentFailedRequest, instrumentRequest, setRequestStartTime, setRequestTimeout } from "./github-client-interceptors";
import { metricHttpRequest } from "config/metric-names";
import { urlParamsMiddleware } from "utils/axios/url-params-middleware";
import { GITHUB_ACCEPT_HEADER } from "utils/get-github-client-config";
import { GitHubClient, GitHubConfig } from "./github-client";
import { GetRepositoriesQuery, GetRepositoriesResponse } from "~/src/github/client/github-queries";

/**
 * A GitHub client that supports authentication as a GitHub User.
 */
export class GitHubUserClient extends GitHubClient {
	private readonly userToken: string;

	constructor(userToken: string, githubConfig: GitHubConfig, logger?: Logger, baseUrl?: string) {
		super(githubConfig, logger, baseUrl);
		this.userToken = userToken;

		this.axios.interceptors.request.use((config: AxiosRequestConfig) => {
			return {
				...config,
				headers: {
					...config.headers,
					...this.headerConfig()
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

	private headerConfig() {
		return {
			Accept: GITHUB_ACCEPT_HEADER,
			Authorization: `token ${this.userToken}`
		};
	}

	public async getUser(): Promise<AxiosResponse<Octokit.UsersGetAuthenticatedResponse>> {
		return await this.get<Octokit.UsersGetAuthenticatedResponse>("/user");
	}

	public async getUserRepositories(per_page = 20, cursor?: string): Promise<GetRepositoriesResponse> {
		try {
			const response = await this.graphql<GetRepositoriesResponse>(GetRepositoriesQuery, {
				headers: this.headerConfig()
			}, {
				per_page,
				cursor
			});
			return response.data.data;
		} catch (err) {
			this.logger.error({ err }, "Could not fetch repositories");
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

	private async get<T>(url, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
		return this.axios.get<T>(url, config);
	}
}
