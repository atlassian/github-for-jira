import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import { AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse } from "axios";
import { AppTokenHolder } from "./app-token-holder";
import { handleFailedRequest, instrumentFailedRequest, instrumentRequest, setRequestStartTime, setRequestTimeout } from "./github-client-interceptors";
import { metricHttpRequest } from "config/metric-names";
import { urlParamsMiddleware } from "utils/axios/url-params-middleware";
import { AuthToken } from "~/src/github/client/auth-token";
import { GITHUB_ACCEPT_HEADER } from "~/src/util/get-github-client-config";
import { GitHubClient, GitHubConfig } from "./github-client";
import { SearchedRepositoriesResponse } from "~/src/github/client/github-queries";

/**
 * A GitHub client that supports authentication as a GitHub app.
 * This is the top level app API: get all installations of this app, or get more info on this app
 *
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps
 */
export class GitHubAppClient extends GitHubClient {
	private readonly appToken: AuthToken;

	constructor(
		gitHubConfig: GitHubConfig,
		logger: Logger,
		appId: string,
		privateKey: string,
	) {
		super(gitHubConfig, logger);
		this.appToken = AppTokenHolder.createAppJwt(privateKey, appId);

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

		this.axios.interceptors.request.use((config: AxiosRequestConfig) => {
			return {
				...config,
				headers: {
					...config.headers,
					...this.appAuthenticationHeaders()
				}
			};
		});
	}

	public getUserMembershipForOrg = async (username: string, org: string): Promise<AxiosResponse<Octokit.OrgsGetMembershipResponse>> => {
		return await this.axios.get<Octokit.OrgsGetMembershipResponse>(`/orgs/{org}/memberships/{username}`, {
			urlParams: {
				username,
				org
			}
		});
	};

	public getApp = async (): Promise<AxiosResponse<Octokit.AppsGetAuthenticatedResponse>> => {
		return await this.axios.get<Octokit.AppsGetAuthenticatedResponse>(`/app`, {});
	};

	/**
	 * Use this config in a request to authenticate with the app token.
	 */
	private appAuthenticationHeaders(): Partial<AxiosRequestHeaders> {
		return {
			Accept: GITHUB_ACCEPT_HEADER,
			Authorization: `Bearer ${this.appToken.token}`
		};
	}

	public getInstallation = async (installationId: number): Promise<AxiosResponse<Octokit.AppsGetInstallationResponse>> => {
		return await this.axios.get<Octokit.AppsGetInstallationResponse>(`/app/installations/{installationId}`, {
			urlParams: {
				installationId
			}
		});
	};

	public getInstallations = async (): Promise<AxiosResponse<Octokit.AppsGetInstallationResponse[]>> => {
		return await this.axios.get<Octokit.AppsGetInstallationResponse[]>(`/app/installations`, {});
	};

	// TODO - move to githubinstallationClient
	public async searchRepositories(queryString: string): Promise<AxiosResponse<SearchedRepositoriesResponse>> {
		return await this.axios.get<SearchedRepositoriesResponse>("search/repositories?q={q}", {
			urlParams: {
				q: queryString
			}
		});
	}
}
