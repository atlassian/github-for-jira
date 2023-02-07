import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { AppTokenHolder } from "./app-token-holder";
import { InstallationTokenCache } from "./installation-token-cache";
import { AuthToken } from "./auth-token";
import { handleFailedRequest, instrumentFailedRequest, instrumentRequest, setRequestStartTime, setRequestTimeout } from "./github-client-interceptors";
import { metricHttpRequest } from "config/metric-names";
import { urlParamsMiddleware } from "utils/axios/url-params-middleware";
import { InstallationId } from "./installation-id";
import {
	getBranchesQueryWithChangedFiles,
	getBranchesQueryWithoutChangedFiles,
	getBranchesResponse,
	getCommitsQueryWithChangedFiles,
	getCommitsQueryWithoutChangedFiles,
	getCommitsResponse,
	GetRepositoriesQuery,
	GetRepositoriesResponse,
	ViewerRepositoryCountQuery,
	getDeploymentsResponse,
	getDeploymentsQuery,
	SearchedRepositoriesResponse
} from "./github-queries";
import {
	ActionsListRepoWorkflowRunsResponseEnhanced,
	GetPullRequestParams,
	PaginatedAxiosResponse,
	ReposGetContentsResponse
} from "./github-client.types";
import { isChangedFilesError } from "./github-client-errors";
import { GITHUB_ACCEPT_HEADER } from "utils/get-github-client-config";
import { GitHubClient, GitHubConfig } from "./github-client";

/**
 * A GitHub client that supports authentication as a GitHub app.
 * API is specific to an organization (e.g. can get all repos for an org)
 *
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps
 */
export class GitHubInstallationClient extends GitHubClient {
	private readonly installationTokenCache: InstallationTokenCache;
	public readonly githubInstallationId: InstallationId;
	public readonly gitHubServerAppId?: number;
	private readonly jiraHost: string;

	constructor(
		githubInstallationId: InstallationId,
		gitHubConfig: GitHubConfig,
		jiraHost: string,
		logger?: Logger,
		gshaId?: number
	) {
		super(gitHubConfig, logger);
		this.jiraHost = jiraHost;

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
		this.installationTokenCache = InstallationTokenCache.getInstance();
		this.githubInstallationId = githubInstallationId;
		this.gitHubServerAppId = gshaId;
	}

	/**
	 * Lists pull requests for the given repository.
	 */
	public async getPullRequests(owner: string, repo: string, pullRequestParams: GetPullRequestParams): Promise<AxiosResponse<Octokit.PullsListResponseItem[]>> {
		return await this.get<Octokit.PullsListResponseItem[]>(`/repos/{owner}/{repo}/pulls`, pullRequestParams, {
			owner,
			repo
		});
	}

	/**
	 * Get a single pull request for the given repository.
	 */
	// TODO: add a unit test
	public async getPullRequest(owner: string, repo: string, pullNumber: string | number): Promise<AxiosResponse<Octokit.PullsGetResponse>> {
		return await this.get<Octokit.PullsGetResponse>(`/repos/{owner}/{repo}/pulls/{pullNumber}`, {}, {
			owner,
			repo,
			pullNumber
		});
	}

	/**
	 * Get all reviews for a specific pull request.
	 */
	public async getPullRequestReviews(owner: string, repo: string, pullNumber: string | number): Promise<AxiosResponse<Octokit.PullsListReviewsResponse>> {
		return await this.get<Octokit.PullsListReviewsResponse>(`/repos/{owner}/{repo}/pulls/{pullNumber}/reviews`, {}, {
			owner,
			repo,
			pullNumber
		});
	}

	/**
	 * Get publicly available information for user with given username.
	 */
	public getUserByUsername = async (username: string): Promise<AxiosResponse<Octokit.UsersGetByUsernameResponse>> => {
		return await this.get<Octokit.UsersGetByUsernameResponse>(`/users/{username}`, {}, {
			username
		});
	};

	/**
	 * Get a single commit for the given repository.
	 */
	public getCommit = async (owner: string, repo: string, ref: string): Promise<AxiosResponse<Octokit.ReposGetCommitResponse>> => {
		return await this.get<Octokit.ReposGetCommitResponse>(`/repos/{owner}/{repo}/commits/{ref}`, {}, {
			owner,
			repo,
			ref
		});
	};

	public compareReferences = async (owner: string, repo: string, baseRef: string, headRef: string): Promise<AxiosResponse<Octokit.ReposCompareCommitsResponse>> => {
		return this.get<Octokit.ReposCompareCommitsResponse>(
			`/repos/{owner}/{repo}/compare/{basehead}`,
			undefined,
			{
				owner,
				repo,
				basehead: `${baseRef}...${headRef}`
			});
	};

	/**
	 * Returns a single reference from Git. The {ref} in the URL must be formatted as heads/<branch name>
	 */
	public getRef = async (owner: string, repo: string, ref: string): Promise<AxiosResponse<Octokit.GitGetRefResponse>> => {
		return await this.get<Octokit.GitGetRefResponse>(`/repos/{owner}/{repo}/git/ref/{ref}`, {}, {
			owner,
			repo,
			ref
		});
	};

	/**
	 * Returns a single head reference from Git.
	 */
	public getRefHead = async (owner: string, repo: string, branch: string): Promise<AxiosResponse<Octokit.GitGetRefResponse>> => {
		return await this.get<Octokit.GitGetRefResponse>(`/repos/{owner}/{repo}/git/ref/heads/{branch}`, {}, {
			owner,
			repo,
			branch
		});
	};

	/**
	 * Get a page of repositories.
	 */
	public getRepositoriesPage = async (per_page = 1, cursor?: string, order_by?: string): Promise<GetRepositoriesResponse> => {
		try {
			const response = await this.graphql<GetRepositoriesResponse>(GetRepositoriesQuery, await this.installationAuthenticationHeaders(), {
				per_page,
				order_by,
				cursor
			});
			return response.data.data;
		} catch (err) {
			err.isRetryable = true;
			throw err;
		}
	};

	public getRepository = async (id: number): Promise<AxiosResponse<any>> => {
		return await this.get<Octokit.GitGetRefResponse>(`/repositories/{id}`, {}, {
			id
		});
	};


	/**
	 * Returns the current status of the rate limit for all resources types
	 */
	public getRateLimit = async (): Promise<AxiosResponse<Octokit.RateLimitGetResponse>> => {
		return await this.get<Octokit.RateLimitGetResponse>(`/rate_limit`, {}, {});
	};

	// TODO: remove this function after discovery backfill is deployed
	public getRepositoriesPageOld = async (page = 1): Promise<PaginatedAxiosResponse<Octokit.AppsListReposResponse>> => {
		const response = await this.get<Octokit.AppsListReposResponse>(`/installation/repositories?per_page={perPage}&page={page}`, {}, {
			perPage: 100,
			page
		});
		const hasNextPage = !!response?.headers.link?.includes("rel=\"next\"");
		return {
			...response,
			hasNextPage
		};
	};

	public searchRepositories = async (queryString: string, order = "updated"): Promise<AxiosResponse<SearchedRepositoriesResponse>> => {
		return await this.get<SearchedRepositoriesResponse>(`search/repositories?q={queryString}&order={order}`,{ },
			{
				queryString,
				order
			}
		);
	};

	public listDeployments = async (owner: string, repo: string, environment: string, per_page: number): Promise<AxiosResponse<Octokit.ReposListDeploymentsResponse>> => {
		return await this.get<Octokit.ReposListDeploymentsResponse>(`/repos/{owner}/{repo}/deployments`,
			{ environment, per_page },
			{ owner, repo }
		);
	};

	public listDeploymentStatuses = async (owner: string, repo: string, deployment_id: number, per_page: number): Promise<AxiosResponse<Octokit.ReposListDeploymentStatusesResponse>> => {
		return await this.get<Octokit.ReposListDeploymentStatusesResponse>(`/repos/{owner}/{repo}/deployments/{deployment_id}/statuses`,
			{ per_page },
			{ owner, repo, deployment_id }
		);
	};

	public listWorkflowRuns = async (owner: string, repo: string, per_page, cursor?: number): Promise<AxiosResponse<ActionsListRepoWorkflowRunsResponseEnhanced>> => {
		return await this.get<ActionsListRepoWorkflowRunsResponseEnhanced>(`/repos/{owner}/{repo}/actions/runs`,
			{ per_page, page: cursor },
			{ owner, repo }
		);
	};

	public async updateIssue({ owner, repo, issue_number, body }: Octokit.IssuesUpdateParams): Promise<AxiosResponse<Octokit.IssuesUpdateResponse>> {
		return await this.patch<Octokit.IssuesUpdateResponse>(`/repos/{owner}/{repo}/issues/{issue_number}`, { body }, {},
			{
				owner,
				repo,
				issue_number
			});
	}

	public async getNumberOfReposForInstallation(): Promise<number> {
		const response = await this.graphql<{ viewer: { repositories: { totalCount: number } } }>(ViewerRepositoryCountQuery, await this.installationAuthenticationHeaders());
		return response?.data?.data?.viewer?.repositories?.totalCount;
	}

	public async getBranchesPage(owner: string, repoName: string, perPage = 1, commitSince?: Date, cursor?: string): Promise<getBranchesResponse> {
		const variables = {
			owner,
			repo: repoName,
			per_page: perPage,
			commitSince: commitSince?.toISOString(),
			cursor
		};
		const config = await this.installationAuthenticationHeaders();
		const response = await this.graphql<getBranchesResponse>(getBranchesQueryWithChangedFiles, config, variables)
			.catch((err) => {
				if (!isChangedFilesError(err)) {
					return Promise.reject(err);
				}

				this.logger.warn("retrying branch graphql query without changedFiles");
				return this.graphql<getBranchesResponse>(getBranchesQueryWithoutChangedFiles, config, variables);
			});
		return response?.data?.data;
	}

	public async getDeploymentsPage(owner: string, repoName: string, perPage?: number, cursor?: string | number): Promise<getDeploymentsResponse> {
		const response = await this.graphql<getDeploymentsResponse>(getDeploymentsQuery,
			await this.installationAuthenticationHeaders(),
			{
				owner,
				repo: repoName,
				per_page: perPage,
				cursor
			});
		return response?.data?.data;
	}

	/**
	 * Attempt to get the commits page, if failing try again omiting the changedFiles field
	 */
	public async getCommitsPage(owner: string, repoName: string, perPage?: number, commitSince?: Date, cursor?: string | number): Promise<getCommitsResponse> {
		const variables = {
			owner,
			repo: repoName,
			per_page: perPage,
			cursor,
			commitSince: commitSince?.toISOString()
		};
		const config = await this.installationAuthenticationHeaders();
		const response = await this.graphql<getCommitsResponse>(getCommitsQueryWithChangedFiles, config, variables)
			.catch((err) => {
				if (!isChangedFilesError(err)) {
					return Promise.reject(err);
				}
				this.logger.warn("retrying commit graphql query without changedFiles");
				return this.graphql<getCommitsResponse>(getCommitsQueryWithoutChangedFiles, config, variables);
			});
		return response?.data?.data;
	}

	public async updateIssueComment({ owner, repo, comment_id, body }: Octokit.IssuesUpdateCommentParams): Promise<AxiosResponse<Octokit.IssuesUpdateCommentResponse>> {
		return await this.patch<Octokit.IssuesUpdateResponse>(
			`/repos/{owner}/{repo}/issues/comments/{comment_id}`,
			{ body },
			{},
			{
				owner,
				repo,
				comment_id
			});
	}

	/**
	 * Get a file at a given path from a repository.
	 * Returns null if the file does not exist.
	 */
	public async getRepositoryFile(owner: string, repo: string, path: string): Promise<string | undefined> {
		try {
			// can't pass the path as a path param, because "/"s would be url encoded
			const response = await this.get<ReposGetContentsResponse>(`/repos/{owner}/{repo}/contents/${path}`, {}, {
				owner,
				repo
			});

			return response.data.content;
		} catch (err) {
			if (err.status == 404) {
				this.logger.debug({ err, owner, repo, path }, "could not find file in repo");
				return undefined;
			}
			throw err;
		}
	}

	/**
	 * Use this config in a request to authenticate with the app token.
	 */
	private async appAuthenticationHeaders(): Promise<Partial<AxiosRequestConfig>> {
		const appToken = await AppTokenHolder.getInstance().getAppToken(this.githubInstallationId, this.jiraHost, this.gitHubServerAppId);
		return {
			headers: {
				Accept: GITHUB_ACCEPT_HEADER,
				Authorization: `Bearer ${appToken.token}`
			}
		};
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
				Accept: GITHUB_ACCEPT_HEADER,
				Authorization: `Bearer ${installationToken.token}`
			}
		};
	}

	/**
	 * Calls the GitHub API in the name of the GitHub app to generate a token that in turn can be used to call the GitHub
	 * API in the name of an installation of that app (to access the users' data).
	 */
	private async createInstallationToken(githubInstallationId: number): Promise<AuthToken> {
		const response = await this.axios.post<Octokit.AppsCreateInstallationTokenResponse>(`/app/installations/{githubInstallationId}/access_tokens`, {}, {
			...await this.appAuthenticationHeaders(),
			urlParams: {
				githubInstallationId
			}
		});
		const tokenResponse: Octokit.AppsCreateInstallationTokenResponse = response.data;
		return new AuthToken(tokenResponse.token, new Date(tokenResponse.expires_at));
	}

	private async get<T>(url, params = {}, urlParams = {}): Promise<AxiosResponse<T>> {
		return this.axios.get<T>(url, {
			...await this.installationAuthenticationHeaders(),
			params,
			urlParams
		});
	}

	private async patch<T>(url, body = {}, params = {}, urlParams = {}): Promise<AxiosResponse<T>> {
		return this.axios.patch<T>(url, body, {
			...await this.installationAuthenticationHeaders(),
			params,
			urlParams
		});
	}
}
