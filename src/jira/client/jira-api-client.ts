import Logger from "bunyan";
import { getAxiosInstance, JiraClientError } from "./axios";
import { AxiosInstance, AxiosResponse } from "axios";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { envVars } from "config/env";
import { uniq } from "lodash";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { TransformedRepositoryId, transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { getJiraId } from "../util/id";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { getDeploymentDebugInfo, extractDeploymentDataForLoggingPurpose } from "./jira-client-deployment-helper";
import {
	truncateIssueKeys,
	getTruncatedIssueKeys,
	withinIssueKeyLimit,
	updateIssueKeyAssociationValuesFor,
	extractAndHashIssueKeysForLoggingPurpose,
	safeParseAndHashUnknownIssueKeysForLoggingPurpose,
	dedupIssueKeys,
	updateIssueKeysFor,
	withinIssueKeyAssociationsLimit,
	truncate
} from "./jira-client-issue-key-helper";
import {
	JiraBuildBulkSubmitData,
	JiraCommit,
	JiraDeploymentBulkSubmitData,
	JiraIssue,
	JiraSubmitOptions,
	JiraVulnerabilityBulkSubmitData
} from "interfaces/jira";

const issueKeyLimitWarning = "Exceeded issue key reference limit. Some issues may not be linked.";

export interface DeploymentsResult {
	status: number;
	rejectedDeployments?: any[];
}

export class JiraClient {
	axios: AxiosInstance;
	logger: Logger;
	jiraHost: string;
	gitHubInstallationId: number;
	gitHubAppId: number | undefined;

	static async create(installation: Installation, gitHubAppId: number | undefined, logger: Logger): Promise<JiraClient> {
		const jiraClient = new JiraClient(installation.jiraHost, installation.id, gitHubAppId, logger);
		await jiraClient.initialize(installation);
		return jiraClient;
	}

	private async initialize(installation: Installation): Promise<void> {
		const secret = await installation.decrypt("encryptedSharedSecret", this.logger);
		this.axios = getAxiosInstance(installation.jiraHost, secret, this.logger);
	}

	private constructor(jiraHost: string, gitHubInstallationId: number, gitHubAppId: number | undefined, logger: Logger) {
		const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);

		this.jiraHost = jiraHost;
		this.gitHubInstallationId = gitHubInstallationId;
		this.gitHubAppId = gitHubAppId;
		this.logger = logger.child({ jiraHost, gitHubInstallationId, gitHubAppId, gitHubProduct });
	}

	async isAuthorized(): Promise<boolean> {
		try {
			return (await this.axios.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")).status === 200;
		} catch (error) {
			if (!(error instanceof JiraClientError)) {
				throw error;
			}
			return false;
		}
	}

	async getCloudId(): Promise<{ cloudId: string }> {
		return (await this.axios.get("_edge/tenant_info")).data;
	}

	async appPropertiesCreate(isConfiguredState: boolean) {
		return await this.axios.put(`/rest/atlassian-connect/latest/addons/${envVars.APP_KEY}/properties/is-configured`, {
			"isConfigured": isConfiguredState
		});
	}

	async appPropertiesGet() {
		return await this.axios.get(`/rest/atlassian-connect/latest/addons/${envVars.APP_KEY}/properties/is-configured`);
	}

	async appPropertiesDelete() {
		return await this.axios.delete(`/rest/atlassian-connect/latest/addons/${envVars.APP_KEY}/properties/is-configured`);
	}

	async linkedWorkspace(subscriptionId: number) {
		const payload = {
			"workspaceIds": [subscriptionId]
		};
		return await this.axios.post("/rest/security/1.0/linkedWorkspaces/bulk", payload);
	}

	async deleteWorkspace(subscriptionId: number) {
		return await this.axios.delete(`/rest/security/1.0/linkedWorkspaces/bulk?workspaceIds=${subscriptionId}`);
	}

	async checkAdminPermissions(accountId: string) {
		const payload = {
			accountId,
			globalPermissions: [
				"ADMINISTER"
			]
		};
		return await this.axios.post("/rest/api/latest/permissions/check", payload);
	}

	// ISSUES
	async getIssue(issueId: string, query = { fields: "summary" }): Promise<AxiosResponse<JiraIssue>> {
		return this.axios.get("/rest/api/latest/issue/{issue_id}", {
			params: query,
			urlParams: {
				issue_id: issueId
			}
		});
	}
	async getAllIssues(issueIds: string[], query?: { fields: string }): Promise<JiraIssue[]> {
		const responses = await Promise.all<AxiosResponse<JiraIssue> | undefined>(
			issueIds.map((issueId) => this.getIssue(issueId, query).catch(() => undefined))
		);
		return responses.reduce((acc: JiraIssue[], response) => {
			if (response?.status === 200 && !!response?.data) {
				acc.push(response.data);
			}
			return acc;
		}, []);
	}

	static parseIssueText(text: string): string[] | undefined {
		if (!text) return undefined;
		return jiraIssueKeyParser(text);
	}

	// ISSUE COMMENTS
	async listIssueComments(issueId: string) {
		return this.axios.get("/rest/api/latest/issue/{issue_id}/comment?expand=properties", {
			urlParams: {
				issue_id: issueId
			}
		});
	}

	async addIssueComment(issueId: string, payload: any) {
		return this.axios.post("/rest/api/latest/issue/{issue_id}/comment", payload, {
			urlParams: {
				issue_id: issueId
			}
		});
	}

	async updateIssueComment(issueId: string, commentId: string, payload: any) {
		return this.axios.put("rest/api/latest/issue/{issue_id}/comment/{comment_id}", payload, {
			urlParams: {
				issue_id: issueId,
				comment_id: commentId
			}
		});
	}

	async deleteIssueComment(issueId: string, commentId: string) {
		return this.axios.delete("rest/api/latest/issue/{issue_id}/comment/{comment_id}", {
			urlParams: {
				issue_id: issueId,
				comment_id: commentId
			}
		});
	}

	// ISSUE TRANSITIONS
	async listIssueTransistions(issueId: string) {
		return this.axios.get("/rest/api/latest/issue/{issue_id}/transitions", {
			urlParams: {
				issue_id: issueId
			}
		});
	}

	async updateIssueTransistions(issueId: string, transitionId: string) {
		return this.axios.post("/rest/api/latest/issue/{issue_id}/transitions", {
			transition: {
				id: transitionId
			}
		}, {
			urlParams: {
				issue_id: issueId
			}
		});
	}

	// ISSUE WORKLOGS
	async addWorklogForIssue(issueId: string, payload: any) {
		return this.axios.post("/rest/api/latest/issue/{issue_id}/worklog", payload, {
			urlParams: {
				issue_id: issueId
			}
		});
	}

	// DELETE INSTALLATION
	async deleteInstallation(gitHubInstallationId: string | number) {
		return Promise.all([
			// We are sending devinfo events with the property "installationId", so we delete by this property.
			this.axios.delete("/rest/devinfo/0.10/bulkByProperties", {
				params: {
					installationId: gitHubInstallationId
				}
			}),
			// We are sending build events with the property "gitHubInstallationId", so we delete by this property.
			this.axios.delete("/rest/builds/0.1/bulkByProperties", {
				params: {
					gitHubInstallationId
				}
			}),
			// We are sending deployments events with the property "gitHubInstallationId", so we delete by this property.
			this.axios.delete("/rest/deployments/0.1/bulkByProperties", {
				params: {
					gitHubInstallationId
				}
			})
		]);
	}

	// DEV INFO
	async deleteBranch(transformedRepositoryId: TransformedRepositoryId, branchRef: string) {
		return this.axios.delete("/rest/devinfo/0.10/repository/{transformedRepositoryId}/branch/{branchJiraId}",
			{
				params: {
					_updateSequenceId: Date.now()
				},
				urlParams: {
					transformedRepositoryId,
					branchJiraId: getJiraId(branchRef)
				}
			}
		);
	}

	async deletePullRequest(transformedRepositoryId: TransformedRepositoryId, pullRequestId: string) {
		return this.axios.delete("/rest/devinfo/0.10/repository/{transformedRepositoryId}/pull_request/{pullRequestId}", {
			params: {
				_updateSequenceId: Date.now()
			},
			urlParams: {
				transformedRepositoryId,
				pullRequestId
			}
		});
	}

	async deleteRepository(repositoryId: number, gitHubBaseUrl?: string) {
		const transformedRepositoryId = transformRepositoryId(repositoryId, gitHubBaseUrl);
		return Promise.all([
			this.axios.delete("/rest/devinfo/0.10/repository/{transformedRepositoryId}", {
				params: {
					_updateSequenceId: Date.now()
				},
				urlParams: {
					transformedRepositoryId
				}
			}),
			this.axios.delete("/rest/builds/0.1/bulkByProperties", {
				params: {
					repositoryId
				}
			}),
			this.axios.delete("/rest/deployments/0.1/bulkByProperties", {
				params: {
					repositoryId
				}
			})
		]);
	}

	// TODO TEST
	async updateRepository(data: any, options?: JiraSubmitOptions) {
		dedupIssueKeys(data);
		if (!withinIssueKeyLimit(data.commits) || !withinIssueKeyLimit(data.branches) || !withinIssueKeyLimit(data.pullRequests)) {
			this.logger.warn({
				truncatedCommitsCount: getTruncatedIssueKeys(data.commits).length,
				truncatedBranchesCount: getTruncatedIssueKeys(data.branches).length,
				truncatedPRsCount: getTruncatedIssueKeys(data.pullRequests).length
			}, issueKeyLimitWarning);
			truncateIssueKeys(data);
			const subscription = await Subscription.getSingleInstallation(
				this.jiraHost,
				this.gitHubInstallationId,
				this.gitHubAppId
			);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}

		return batchedBulkUpdate(
			data,
			this.axios,
			this.gitHubInstallationId,
			this.logger,
			options
		);
	}

	async submitBuilds(data: JiraBuildBulkSubmitData, repositoryId: number, options?: JiraSubmitOptions) {
		updateIssueKeysFor(data.builds, uniq);
		if (!withinIssueKeyLimit(data.builds)) {
			this.logger.warn({ truncatedBuilds: getTruncatedIssueKeys(data.builds) }, issueKeyLimitWarning);
			updateIssueKeysFor(data.builds, truncate);
			const subscription = await Subscription.getSingleInstallation(this.jiraHost, this.gitHubInstallationId, this.gitHubAppId);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}

		const payload = {
			builds: data.builds,
			properties: {
				gitHubInstallationId: this.gitHubInstallationId,
				repositoryId
			},
			providerMetadata: {
				product: data.product
			},
			preventTransitions: options?.preventTransitions || false,
			operationType: options?.operationType || "NORMAL"
		};

		this.logger.info("Sending builds payload to jira.");
		return this.axios.post("/rest/builds/0.1/bulk", payload);
	}

	// TODO TEST
	async submitDeployments(data: JiraDeploymentBulkSubmitData, repositoryId: number, options?: JiraSubmitOptions): Promise<DeploymentsResult> {
		updateIssueKeysFor(data.deployments, uniq);
		if (!withinIssueKeyLimit(data.deployments)) {
			this.logger.warn({ truncatedDeployments: getTruncatedIssueKeys(data.deployments) }, issueKeyLimitWarning);
			updateIssueKeysFor(data.deployments, truncate);
			const subscription = await Subscription.getSingleInstallation(this.jiraHost, this.gitHubInstallationId, this.gitHubAppId);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}
		const payload = {
			deployments: data.deployments,
			properties: {
				gitHubInstallationId: this.gitHubInstallationId,
				repositoryId
			},
			preventTransitions: options?.preventTransitions || false,
			operationType: options?.operationType || "NORMAL"
		};

		this.logger.info({ ...extractDeploymentDataForLoggingPurpose(data, this.logger) }, "Sending deployments payload to jira.");
		const response: AxiosResponse = await this.axios.post("/rest/deployments/0.1/bulk", payload);

		if (
			response.data?.rejectedDeployments?.length ||
			response.data?.unknownIssueKeys?.length ||
			response.data?.unknownAssociations?.length
		) {
			this.logger.warn({
				acceptedDeployments: response.data?.acceptedDeployments,
				rejectedDeployments: response.data?.rejectedDeployments,
				unknownIssueKeys: response.data?.unknownIssueKeys,
				unknownAssociations: response.data?.unknownAssociations,
				options,
				...getDeploymentDebugInfo(data)
			}, "Jira API rejected deployment!");
		} else {
			this.logger.info({
				acceptedDeployments: response.data?.acceptedDeployments,
				options,
				...getDeploymentDebugInfo(data)
			}, "Jira API accepted deployment!");
		}

		return {
			status: response.status,
			rejectedDeployments: response.data?.rejectedDeployments
		};
	}

	async submitRemoteLinks(data, options?: JiraSubmitOptions) {
		// Note: RemoteLinks doesn't have an issueKey field and takes in associations instead
		updateIssueKeyAssociationValuesFor(data.remoteLinks, uniq);
		if (!withinIssueKeyAssociationsLimit(data.remoteLinks)) {
			updateIssueKeyAssociationValuesFor(data.remoteLinks, truncate);
			const subscription = await Subscription.getSingleInstallation(this.jiraHost, this.gitHubInstallationId, this.gitHubAppId);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}
		const payload = {
			remoteLinks: data.remoteLinks,
			properties: {
				gitHubInstallationId: this.gitHubInstallationId
			},
			preventTransitions: options?.preventTransitions || false,
			operationType: options?.operationType || "NORMAL"
		};
		this.logger.info("Sending remoteLinks payload to jira.");
		return this.axios.post("/rest/remotelinks/1.0/bulk", payload);
	}

	async submitVulnerabilities(data: JiraVulnerabilityBulkSubmitData, options?: JiraSubmitOptions): Promise<AxiosResponse> {
		const payload = {
			vulnerabilities: data.vulnerabilities,
			properties: {
				gitHubInstallationId: this.gitHubInstallationId
			},
			operationType: options?.operationType || "NORMAL"
		};
		this.logger.info("Sending vulnerabilities payload to jira.");
		return await this.axios.post("/rest/security/1.0/bulk", payload);
	}
}

// TODO MOVE TO new jira-client-commit-helper.ts
const deduplicateCommits = (commits: JiraCommit[] = []): JiraCommit[] => {
	const uniqueCommits = commits.reduce((accumulator: JiraCommit[], currentCommit: JiraCommit) => {
		if (!accumulator.some((commit) => commit.id === currentCommit.id)) {
			accumulator.push(currentCommit);
		}
		return accumulator;
	}, []);
	return uniqueCommits;
};

// TODO MOVE TO new jira-client-commit-helper.ts
/**
 * Splits commits in data payload into chunks of 400 and makes separate requests
 * to avoid Jira API limit
 */
const batchedBulkUpdate = async (
	data,
	instance: AxiosInstance,
	installationId: number | undefined,
	logger: Logger,
	options?: JiraSubmitOptions
) => {
	const dedupedCommits = deduplicateCommits(data.commits);
	// Initialize with an empty chunk of commits so we still process the request if there are no commits in the payload
	const commitChunks: JiraCommit[][] = [];
	do {
		commitChunks.push(dedupedCommits.splice(0, 400));
	} while (dedupedCommits.length);

	const batchedUpdates = commitChunks.map(async (commitChunk: JiraCommit[]) => {
		if (commitChunk.length) {
			data.commits = commitChunk;
		}
		const body = {
			preventTransitions: options?.preventTransitions || false,
			operationType: options?.operationType || "NORMAL",
			repositories: [data],
			properties: {
				installationId
			}
		};

		logger.info({
			issueKeys: extractAndHashIssueKeysForLoggingPurpose(commitChunk, logger)
		}, "Posting to Jira devinfo bulk update api");

		const response = await instance.post("/rest/devinfo/0.10/bulk", body);
		logger.info({
			responseStatus: response.status,
			unknownIssueKeys: safeParseAndHashUnknownIssueKeysForLoggingPurpose(response.data, logger)
		}, "Jira devinfo bulk update api returned");

		return response;
	});
	return Promise.all(batchedUpdates);
};
