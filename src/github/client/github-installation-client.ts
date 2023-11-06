import Logger from "bunyan";
import { Octokit } from "@octokit/rest";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { AppTokenHolder } from "./app-token-holder";
import { InstallationTokenCache } from "./installation-token-cache";
import { AuthToken } from "./auth-token";
import { InstallationId } from "./installation-id";
import {
	getBranchesQueryWithChangedFiles,
	getBranchesQueryWithoutChangedFiles,
	getBranchesQueryWithoutCommits,
	getBranchesResponse,
	getCommitsQueryWithChangedFiles,
	getCommitsQueryWithoutChangedFiles,
	getCommitsResponse,
	GetRepositoriesQuery,
	GetRepositoriesResponse,
	ViewerRepositoryCountQuery,
	getDeploymentsResponse,
	getDeploymentsQueryWithStatuses,
	SearchedRepositoriesResponse,
	getPullRequests,
	pullRequestQueryResponse
} from "./github-queries";
import {
	ActionsListRepoWorkflowRunsResponseEnhanced,
	CreateReferenceBody, GetCodeScanningAlertRequestParams,
	DependabotAlertResponseItem,
	GetDependabotAlertRequestParams,
	GetPullRequestParams,
	GetSecretScanningAlertRequestParams,
	PaginatedAxiosResponse,
	ReposGetContentsResponse,
	SecretScanningAlertResponseItem,
	CodeScanningAlertResponseItem
} from "./github-client.types";
import { GITHUB_ACCEPT_HEADER } from "./github-client-constants";
import { GitHubClient, GitHubConfig, Metrics } from "./github-client";
import { GithubClientError, GithubClientGraphQLError } from "~/src/github/client/github-client-errors";
import { cloneDeep } from "lodash";
import { BooleanFlags, booleanFlag } from "config/feature-flags";
import { logCurlOutputInChunks, runCurl } from "utils/curl/curl-utils";

// Unfortunately, the type is not exposed in Octokit...
// https://docs.github.com/en/rest/pulls/review-requests?apiVersion=2022-11-28#get-all-requested-reviewers-for-a-pull-request
export type PullRequestedReviewersResponse = {
	users: Array<Octokit.PullsUpdateResponseRequestedReviewersItem>,
	teams: Array<Octokit.PullsUpdateResponseRequestedTeamsItem>,
}

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
		metrics: Metrics,
		logger: Logger,
		gshaId?: number
	) {
		super(gitHubConfig, jiraHost, metrics, logger);
		this.jiraHost = jiraHost;

		this.installationTokenCache = InstallationTokenCache.getInstance();
		this.githubInstallationId = githubInstallationId;
		this.gitHubServerAppId = gshaId;
	}

	public getUserMembershipForOrg = async (username: string, org: string): Promise<AxiosResponse<Octokit.OrgsGetMembershipResponse>> => {
		return await this.get<Octokit.OrgsGetMembershipResponse>(`/orgs/{org}/memberships/{username}`, {}, {
			username,
			org
		});
	};

	public async getSecretScanningAlerts(owner: string, repo: string, secretScanningAlertRequestParams: GetSecretScanningAlertRequestParams): Promise<AxiosResponse<SecretScanningAlertResponseItem[]>> {
		return await this.get<SecretScanningAlertResponseItem[]>(`/repos/{owner}/{repo}/secret-scanning/alerts`, secretScanningAlertRequestParams, {
			owner,
			repo
		});
	}

	public async getSecretScanningAlert(alertNumber: number, owner: string, repo: string): Promise<AxiosResponse<SecretScanningAlertResponseItem>> {
		return await this.get<SecretScanningAlertResponseItem>(`/repos/{owner}/{repo}/secret-scanning/alerts/{alertNumber}`, {}, {
			owner,
			repo,
			alertNumber
		});
	}

	public async getCodeScanningAlerts(owner: string, repo: string, codeScanningAlertRequestParams: GetCodeScanningAlertRequestParams): Promise<AxiosResponse<CodeScanningAlertResponseItem[]>> {
		return await this.get<CodeScanningAlertResponseItem[]>(`/repos/{owner}/{repo}/code-scanning/alerts`, codeScanningAlertRequestParams, {
			owner,
			repo
		});
	}

	public async getCodeScanningAlert(owner: string, repo: string, alertNumber: number): Promise<AxiosResponse<CodeScanningAlertResponseItem>> {
		return await this.get<CodeScanningAlertResponseItem>(`/repos/{owner}/{repo}/code-scanning/alerts/{alertNumber}`, {}, {
			owner,
			repo,
			alertNumber
		});
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
	public async getPullRequestPage(owner: string, repo: string, per_page = 100, cursor?: string): Promise<pullRequestQueryResponse> {
		const response = await this.graphql<pullRequestQueryResponse>(getPullRequests, await this.installationAuthenticationHeaders(), {
			owner,
			repo,
			per_page,
			cursor
		}, { graphQuery: "getPullRequests" });
		return response.data.data;
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

	public async getPullRequestRequestedReviews(owner: string, repo: string, pullNumber: string | number): Promise<AxiosResponse<PullRequestedReviewersResponse>> {
		return await this.get<PullRequestedReviewersResponse>(`/repos/{owner}/{repo}/pulls/{pullNumber}/requested_reviewers`, {}, {
			owner,
			repo,
			pullNumber
		});
	}

	/**
	 * Get publicly available information for user with given username.
	 */
	public getUserByUsername = async (username: string): Promise<AxiosResponse<Octokit.UsersGetByUsernameResponse>> => {
		const response = await this.get<Octokit.UsersGetByUsernameResponse>(`/users/{username}`, {}, {
			username
		});
		if (response.status === 200 && response.data) {
			if (!response.data.email) {
				this.logger.info("Empty e-mail");
			} else if (response.data.email.includes("noreply.github.com")) {
				this.logger.info("Fake e-mail");
			} else {
				this.logger.info("OK e-mail");
			}
		}
		return response;
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
			}, { graphQuery: "GetRepositoriesQuery" });
			return response.data.data;
		} catch (err: unknown) {
			(err as any).isRetryable = true;
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
		return await this.get<Octokit.RateLimitGetResponse>(`/rate_limit`);
	};

	// TODO: remove this function after discovery backfill is deployed
	public getRepositoriesPageOld = async (perPage: number, page = 1): Promise<PaginatedAxiosResponse<Octokit.AppsListReposResponse>> => {
		try {
			const response = await this.get<Octokit.AppsListReposResponse>(`/installation/repositories?per_page={perPage}&page={page}`, {}, {
				perPage,
				page
			});
			const hasNextPage = !!response?.headers.link?.includes("rel=\"next\"");
			return {
				...response,
				hasNextPage
			};
		} catch (err: unknown) {
			try {
				if (await booleanFlag(BooleanFlags.LOG_CURLV_OUTPUT, this.jiraHost)) {
					this.logger.warn("Found error listing repos, run curl commands to get more details");
					const { headers } = await this.installationAuthenticationHeaders();
					const { Authorization } = headers as { Authorization: string };
					const output = await runCurl({
						fullUrl: `${this.restApiUrl}/installation/repositories?per_page=${perPage}&page=${page}`,
						method: "GET",
						authorization: Authorization
					});
					logCurlOutputInChunks(output, this.logger);
				}
			} catch (curlE) {
				this.logger.error({ err: curlE?.stderr }, "Error running curl for list repos");
			}
			throw err;
		}
	};

	public async getReference(owner: string, repo: string, branch: string): Promise<AxiosResponse<Octokit.GitGetRefResponse>> {
		return await this.get<Octokit.GitGetRefResponse>(`/repos/{owner}/{repo}/git/refs/heads/{branch}`, {}, {
			owner,
			repo,
			branch
		});
	}

	public async getReferences(owner: string, repo: string, per_page = 100): Promise<AxiosResponse<Octokit.ReposGetBranchResponse[]>> {
		return await this.get<Octokit.ReposGetBranchResponse[]>(`/repos/{owner}/{repo}/branches?per_page={per_page}`, {},{
			owner,
			repo,
			per_page
		});
	}

	public async createReference(owner: string, repo: string, body: CreateReferenceBody): Promise<AxiosResponse<Octokit.GitCreateRefResponse>> {
		return await this.post<Octokit.GitCreateRefResponse>(`/repos/{owner}/{repo}/git/refs`, body, {},
			{
				owner,
				repo
			});
	}

	public async getRepositoryByOwnerRepo(owner: string, repo: string): Promise<AxiosResponse<Octokit.ReposGetResponseSource>> {
		return await this.get<Octokit.ReposGetResponseSource>(`/repos/{owner}/{repo}`, {}, {
			owner,
			repo
		});
	}

	public searchRepositories = async (queryString: string, order = "updated"): Promise<AxiosResponse<SearchedRepositoriesResponse>> => {
		const resp =  await this.get<SearchedRepositoriesResponse>(`search/repositories?q={queryString}&order={order}`,{ },
			{
				queryString,
				order
			}
		);
		if (!resp.data?.items?.length) {
			if (await booleanFlag(BooleanFlags.LOG_CURLV_OUTPUT, this.jiraHost)) {
				try {
					this.logger.warn({ queryString, order }, "Couldn't find repo, run curl for commands to get from github, try again with curl");
					const { headers } = await this.installationAuthenticationHeaders();
					const { Authorization } = headers as { Authorization: string };
					const output = await runCurl({
						fullUrl: `${this.restApiUrl}/search/repositories?q=${encodeURIComponent(queryString)}&order=${order}`,
						method: "GET",
						authorization: Authorization
					});
					logCurlOutputInChunks(output, this.logger);
				} catch (curlE) {
					this.logger.error({ err: curlE?.stderr }, "Error running curl for list repos");
				}
			}
		}
		return resp;
	};

	public listDeployments = async (owner: string, repo: string, environment: string, per_page: number): Promise<AxiosResponse<Octokit.ReposListDeploymentsResponse>> => {
		try {
			return await this.get<Octokit.ReposListDeploymentsResponse>(`/repos/{owner}/{repo}/deployments`,
				{ environment, per_page },
				{ owner, repo }
			);
		} catch (e: unknown) {
			try {
				if (await booleanFlag(BooleanFlags.LOG_CURLV_OUTPUT, this.jiraHost)) {
					this.logger.warn("Found error listing deployments, run curl commands to get more details");
					const { headers } = await this.installationAuthenticationHeaders();
					const { Authorization } = headers as { Authorization: string };
					const output = await runCurl({
						fullUrl: `${this.restApiUrl}/repos/${owner}/${repo}/deployments`,
						method: "GET",
						authorization: Authorization
					});
					logCurlOutputInChunks(output, this.logger);
				}
			} catch (curlE) {
				this.logger.error({ err: curlE?.stderr }, "Error running curl for list deployments");
			}
			throw e;
		}
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
		const response = await this.graphql<{ viewer: { repositories: { totalCount: number } } }>(ViewerRepositoryCountQuery, await this.installationAuthenticationHeaders(), undefined, { graphQuery: "ViewerRepositoryCountQuery" });
		return response?.data?.data?.viewer?.repositories?.totalCount;
	}

	public async getDependabotAlerts(owner: string, repo: string, dependabotAlertRequestParams: GetDependabotAlertRequestParams): Promise<AxiosResponse<DependabotAlertResponseItem[]>> {
		return await this.get<DependabotAlertResponseItem[]>(`/repos/{owner}/{repo}/dependabot/alerts`, dependabotAlertRequestParams, {
			owner,
			repo
		});
	}

	public async getDependabotAlert(owner: string, repo: string, alertNumber: number): Promise<AxiosResponse<DependabotAlertResponseItem>> {
		return await this.get<DependabotAlertResponseItem>(`/repos/{owner}/{repo}/dependabot/alerts/{alertNumber}`, {}, {
			owner,
			repo,
			alertNumber
		});
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
		const response = await this.graphql<getBranchesResponse>(getBranchesQueryWithChangedFiles, config, variables, { graphQuery: "getBranchesQueryWithChangedFiles" })
			.catch((err) => {
				if ((err instanceof GithubClientGraphQLError && err.isChangedFilesError()) ||
					// Unfortunately, 502s are not going away when retried with changedFiles, even after delay
					(err instanceof GithubClientError && err.status === 502)
				) {
					this.logger.warn({ err }, "retrying branch graphql query without changedFiles");
					return this.graphql<getBranchesResponse>(getBranchesQueryWithoutChangedFiles, config, variables, { graphQuery: "getBranchesQueryWithoutChangedFiles" })
						.catch((err) => {
							if (err instanceof GithubClientError && err.status === 502) {
								this.logger.warn({ err, body: err.cause.response?.data }, "retrying branch graphql query without commits");
								const variablesNoCommitSince = cloneDeep(variables);
								delete variablesNoCommitSince.commitSince;
								return this.graphql<getBranchesResponse>(
									getBranchesQueryWithoutCommits,
									config,
									variablesNoCommitSince,
									{ graphQuery: "getBranchesQueryWithoutCommits" }
								).then(response => {
									this.logger.info("retrying without commits fixed the issue!");
									response.data.data.repository.refs.edges.forEach(edge => {
										edge.node.target.history = {
											nodes: []
										};
									});
									return response;
								});
							}
							return Promise.reject(err);
						});
				}
				return Promise.reject(err);
			});
		return response?.data?.data;
	}

	public async getDeploymentsPage(owner: string, repoName: string, perPage?: number, cursor?: string | number): Promise<getDeploymentsResponse> {

		const response = await this.graphql<getDeploymentsResponse>(getDeploymentsQueryWithStatuses,
			await this.installationAuthenticationHeaders(),
			{
				owner,
				repo: repoName,
				per_page: perPage,
				cursor
			},
			{ graphQuery: "getDeploymentsQuery" });
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
		const response = await this.graphql<getCommitsResponse>(getCommitsQueryWithChangedFiles, config, variables, { graphQuery: "getCommitsQueryWithChangedFiles" })
			.catch((err) => {
				if ((err instanceof GithubClientGraphQLError && err.isChangedFilesError()) ||
					// Unfortunately, 502s are not going away when retried with changedFiles, even after delay
					(err instanceof GithubClientError && err.status === 502)
				) {
					this.logger.warn({ err },"retrying commit graphql query without changedFiles");
					return this.graphql<getCommitsResponse>(getCommitsQueryWithoutChangedFiles, config, variables, { graphQuery: "getCommitsQueryWithoutChangedFiles" });
				}
				return Promise.reject(err);
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
		} catch (e: unknown) {
			const err = e as { status?: number };
			if (err?.status == 404) {
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
			this.gitHubServerAppId,
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

	private async post<T>(url, body = {}, params = {}, urlParams = {}): Promise<AxiosResponse<T>> {
		return this.axios.post<T>(url, body, {
			...await this.installationAuthenticationHeaders(),
			params,
			urlParams
		});
	}
}
