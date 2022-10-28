import Logger from "bunyan";
import { getLogger } from "config/logger";
import { getCloudOrServerFromGitHubAppId, GithubProductEnum } from "utils/get-cloud-or-server";
import { Installation } from "models/installation";
import { getAxiosInstance } from "~/src/jira/client/axios";
import { AxiosInstance, AxiosResponse } from "axios";
import { JiraCommit, JiraIssue, JiraIssueCommentPayload, JiraIssueComments, JiraIssueTransitions, JiraIssueWorklog, JiraIssueWorklogPayload, JiraRepositoryEntityType, JiraSubmitOptions } from "interfaces/jira";
import { TransformedRepositoryId } from "~/src/transforms/transform-repository-id";
import { getJiraId } from "~/src/jira/util/id";
import { Subscription } from "models/subscription";
import { shouldTagBackfillRequests } from "config/feature-flags";

// Max number of issue keys we can pass to the Jira API
export const ISSUE_KEY_API_LIMIT = 100;
const issueKeyLimitWarning = "Exceeded issue key reference limit. Some issues may not be linked.";

export class JiraClient {
	private readonly axios: AxiosInstance;
	private readonly logger: Logger;
	private readonly gitHubProduct: GithubProductEnum;
	private readonly gitHubInstallationId: number;
	private readonly gitHubAppId?: number;
	private readonly installation: Installation;

	public get jiraHost() {
		return this.installation.jiraHost;
	}

	constructor(installation: Installation, axios: AxiosInstance, gitHubInstallationId: number, gitHubProduct: GithubProductEnum, logger: Logger, gitHubAppId?: number) {
		this.installation = installation;
		this.gitHubProduct = gitHubProduct;
		this.gitHubInstallationId = gitHubInstallationId;
		this.gitHubAppId = gitHubAppId;
		this.logger = logger;
		this.axios = axios;
	}

	static async create(jiraHost: string, gitHubInstallationId: number, gitHubAppId?: number, log: Logger = getLogger("jira-client")): Promise<JiraClient> {
		const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);
		const logger = log.child({ jiraHost, gitHubInstallationId, gitHubProduct });
		const installation = await Installation.getForHost(jiraHost);

		if (!installation) {
			const msg = "Cannot initialize Jira Client, Installation doesn't exist.";
			logger.warn(msg);
			throw new Error(msg);
		}

		const axiosInstance = getAxiosInstance(
			installation.jiraHost,
			await installation.decrypt("encryptedSharedSecret"),
			logger
		);

		return new JiraClient(installation, axiosInstance, gitHubInstallationId, gitHubProduct, logger, gitHubAppId);
	}

	public async getIssue(issueId: string, query = { fields: "summary" }): Promise<AxiosResponse<JiraIssue>> {
		return await this.axios.get("/rest/api/latest/issue/{issue_id}", {
			params: query,
			urlParams: {
				issue_id: issueId
			}
		});
	}

	public async getAllIssues(issueIds: string[], query?: { fields: string }): Promise<JiraIssue[]> {
		const responses = await Promise.all<AxiosResponse<JiraIssue> | undefined>(
			issueIds.map((issueId) => this.getIssue(issueId, query)
				// Ignore any errors
				.catch(() => undefined)
			));
		return responses
			.filter((response) => response?.status === 200 && !!response?.data)
			.map(response => response!.data);
	}

	public async getIssueComments(issueIdOrKey: string): Promise<AxiosResponse<JiraIssueComments>> {
		return this.axios.get("/rest/api/latest/issue/{issueIdOrKey}/comment?expand=properties", {
			urlParams: {
				issueIdOrKey
			}
		});
	}

	public async addIssueComment(issueIdOrKey: string, payload: JiraIssueCommentPayload): Promise<AxiosResponse> {
		return await this.axios.post("/rest/api/latest/issue/{issueIdOrKey}/comment", payload, {
			urlParams: {
				issueIdOrKey
			}
		});
	}

	public async updateIssueComment(issueIdOrKey: string, commendId: string, payload: JiraIssueCommentPayload): Promise<AxiosResponse> {
		return await this.axios.put("rest/api/latest/issue/{issueIdOrKey}/comment/{commendId}", payload, {
			urlParams: {
				issueIdOrKey,
				commendId
			}
		});
	}

	public async deleteIssueComment(issueIdOrKey: string, commendId: string): Promise<AxiosResponse> {
		return await this.axios.delete("rest/api/latest/issue/{issueIdOrKey}/comment/{commendId}", {
			urlParams: {
				issueIdOrKey,
				commendId
			}
		});
	}

	public async getIssueTransitions(issueIdOrKey: string): Promise<AxiosResponse<JiraIssueTransitions>> {
		return await this.axios.get("/rest/api/latest/issue/{issueIdOrKey}/transitions", {
			urlParams: {
				issueIdOrKey
			}
		});
	}

	public async performIssueTransition(issueIdOrKey: string, transitionId: string): Promise<AxiosResponse> {
		return await this.axios.post(
			"/rest/api/latest/issue/{issueIdOrKey}/transitions",
			{
				transition: {
					id: transitionId
				}
			},
			{
				urlParams: {
					issueIdOrKey
				}
			}
		);
	}

	public async addIssueWorklog(issueIdOrKey: string, payload: JiraIssueWorklogPayload): Promise<AxiosResponse<JiraIssueWorklog>> {
		return await this.axios.post("/rest/api/latest/issue/{issueIdOrKey}/worklog", payload, {
			urlParams: {
				issueIdOrKey
			}
		});
	}

	public async deleteRepository(transformedRepositoryId: TransformedRepositoryId): Promise<AxiosResponse> {
		return await this.axios.delete("/rest/devinfo/0.10/repository/{transformedRepositoryId}", {
			params: {
				_updateSequenceId: Date.now()
			},
			urlParams: {
				transformedRepositoryId
			}
		});
	}

	public async updateRepository(data, options?: JiraSubmitOptions): Promise<AxiosResponse[]> {
		dedupIssueKeys(data);

		if (
			!withinIssueKeyLimit(data.commits) ||
			!withinIssueKeyLimit(data.branches) ||
			!withinIssueKeyLimit(data.pullRequests)
		) {
			this.logger.warn({
				truncatedCommitsCount: getTruncatedIssuekeys(data.commits).length,
				truncatedBranchesCount: getTruncatedIssuekeys(data.branches).length,
				truncatedPRsCount: getTruncatedIssuekeys(data.pullRequests).length
			}, issueKeyLimitWarning);
			truncateIssueKeys(data);
			const subscription = await Subscription.getSingleInstallation(
				jiraHost,
				this.gitHubInstallationId,
				this.gitHubAppId
			);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}

		return this.batchedBulkUpdate(
			data,
			this.gitHubInstallationId,
			options
		);
	}

	public async deleteBranch(transformedRepositoryId: TransformedRepositoryId, branchRef: string): Promise<AxiosResponse> {
		return await this.deleteRepositoryEntity(transformedRepositoryId, "branch", getJiraId(branchRef));
	}

	public async deleteCommit(transformedRepositoryId: TransformedRepositoryId, commitRef: string): Promise<AxiosResponse> {
		return await this.deleteRepositoryEntity(transformedRepositoryId, "commit", commitRef);
	}

	public async deletePullRequest(transformedRepositoryId: TransformedRepositoryId, pullRequestId: string): Promise<AxiosResponse> {
		return await this.deleteRepositoryEntity(transformedRepositoryId, "pull_request", pullRequestId);
	}

	public async deleteInstallation(gitHubInstallationId: string | number): Promise<AxiosResponse[]> {
		return await Promise.all([
			// We are sending devinfo events with the property "installationId", so we delete by this property.
			this.axios.delete(
				"/rest/devinfo/0.10/bulkByProperties",
				{
					params: {
						installationId: gitHubInstallationId
					}
				}
			),

			// We are sending build events with the property "gitHubInstallationId", so we delete by this property.
			this.axios.delete(
				"/rest/builds/0.1/bulkByProperties",
				{
					params: {
						gitHubInstallationId
					}
				}
			),

			// We are sending deployments events with the property "gitHubInstallationId", so we delete by this property.
			this.axios.delete(
				"/rest/deployments/0.1/bulkByProperties",
				{
					params: {
						gitHubInstallationId
					}
				}
			)
		]);
	}

	private async deleteRepositoryEntity(transformedRepositoryId: TransformedRepositoryId, entityType: JiraRepositoryEntityType, entityId: string): Promise<AxiosResponse> {
		return await this.axios.delete(
			"/rest/devinfo/0.10/repository/{transformedRepositoryId}/{entityType}/{entityId}",
			{
				params: {
					_updateSequenceId: Date.now()
				},
				urlParams: {
					transformedRepositoryId,
					entityType,
					entityId
				}
			}
		);
	}

	private async batchedBulkUpdate(data, installationId: number, options?: JiraSubmitOptions) {
		const dedupedCommits = dedupCommits(data.commits);

		// Initialize with an empty chunk of commits so we still process the request if there are no commits in the payload
		const commitChunks: JiraCommit[][] = [];
		do {
			commitChunks.push(dedupedCommits.splice(0, 400));
		} while (dedupedCommits.length);

		const shouldTagBackfillRequestsValue = await shouldTagBackfillRequests();
		const batchedUpdates = commitChunks.map((commitChunk) => {
			if (commitChunk.length) {
				data.commits = commitChunk;
			}
			let body;
			if (shouldTagBackfillRequestsValue) {
				body = {
					preventTransitions: options?.preventTransitions || false,
					operationType: options?.operationType || "NORMAL",
					repositories: [data],
					properties: {
						installationId
					}
				};
			} else {
				body = {
					preventTransitions: options?.preventTransitions || false,
					repositories: [data],
					properties: {
						installationId
					}
				};
			}
			return this.axios.post("/rest/devinfo/0.10/bulk", body);
		});
		return Promise.all(batchedUpdates);
	}
}
