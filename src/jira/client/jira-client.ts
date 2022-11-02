import Logger from "bunyan";
import { getLogger } from "config/logger";
import { getCloudOrServerFromGitHubAppId, GithubProductEnum } from "utils/get-cloud-or-server";
import { Installation } from "models/installation";
import { getAxiosInstance } from "~/src/jira/client/axios";
import { AxiosInstance, AxiosResponse } from "axios";
import {
	JiraAssociation,
	JiraCommit,
	JiraIssue,
	JiraIssueCommentPayload,
	JiraIssueComments,
	JiraIssueKeyObject,
	JiraIssueTransitions,
	JiraIssueWorklog,
	JiraIssueWorklogPayload,
	JiraRemoteLink,
	JiraRepositoryEntityType,
	JiraSubmitOptions
} from "interfaces/jira";
import { TransformedRepositoryId } from "~/src/transforms/transform-repository-id";
import { getJiraId } from "~/src/jira/util/id";
import { Subscription } from "models/subscription";
import { shouldTagBackfillRequests } from "config/feature-flags";
import { uniq } from "lodash";
import { DeploymentsResult, getTruncatedIssuekeys } from "~/src/jira/client/jira-client.old";

// Max number of issue keys we can pass to the Jira API
export const ISSUE_KEY_API_LIMIT = 100;
const issueKeyLimitWarning = "Exceeded issue key reference limit. Some issues may not be linked.";

export class JiraClient {
	private readonly axios: AxiosInstance;
	private readonly logger: Logger;
	public readonly gitHubProduct: GithubProductEnum;
	public readonly gitHubInstallationId: number;
	public readonly gitHubAppId?: number;
	public readonly installation: Installation;

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
		this.dedupIssueKeys(data);

		if (
			!this.withinIssueKeyLimit(data.commits) ||
			!this.withinIssueKeyLimit(data.branches) ||
			!this.withinIssueKeyLimit(data.pullRequests)
		) {
			this.logger.warn({
				truncatedCommitsCount: this.getTruncatedIssuekeys(data.commits).length,
				truncatedBranchesCount: this.getTruncatedIssuekeys(data.branches).length,
				truncatedPRsCount: this.getTruncatedIssuekeys(data.pullRequests).length
			}, issueKeyLimitWarning);
			this.truncateIssueKeys(data);
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

	public async sendWorkflow(data, options?: JiraSubmitOptions): Promise<AxiosResponse> {
		this.updateIssueKeysFor(data.builds, uniq);
		if (!this.withinIssueKeyLimit(data.builds)) {
			this.logger.warn({
				truncatedBuilds: getTruncatedIssuekeys(data.builds)
			}, issueKeyLimitWarning);
			this.updateIssueKeysFor(data.builds, this.truncate);
			const subscription = await Subscription.getSingleInstallation(jiraHost, this.gitHubInstallationId, this.gitHubAppId);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}
		let payload;
		if (await shouldTagBackfillRequests()) {
			payload = {
				builds: data.builds,
				properties: {
					gitHubInstallationId: this.gitHubInstallationId
				},
				providerMetadataprivate: {
					product: data.product
				},
				preventTransitions: options?.preventTransitions || false,
				operationType: options?.operationType || "NORMAL"
			};
		} else {
			payload = {
				builds: data.builds,
				properties: {
					gitHubInstallationId: this.gitHubInstallationId
				},
				providerMetadata: {
					product: data.product
				}
			};
		}
		this.logger.info({ gitHubProduct: this.gitHubProduct }, "Sending builds payload to jira.");
		return await this.axios.post("/rest/builds/0.1/bulk", payload);
	}

	public async sendDeployment(data, options?: JiraSubmitOptions): Promise<DeploymentsResult> {
		this.updateIssueKeysFor(data.deployments, uniq);
		if (!this.withinIssueKeyLimit(data.deployments)) {
			this.logger.warn({
				truncatedDeployments: getTruncatedIssuekeys(data.deployments)
			}, issueKeyLimitWarning);
			this.updateIssueKeysFor(data.deployments, this.truncate);
			const subscription = await Subscription.getSingleInstallation(jiraHost, this.gitHubInstallationId, this.gitHubAppId);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}
		let payload;
		if (await shouldTagBackfillRequests()) {
			payload = {
				deployments: data.deployments,
				properties: {
					gitHubInstallationId: this.gitHubInstallationId
				},
				preventTransitions: options?.preventTransitions || false,
				operationType: options?.operationType || "NORMAL"
			};
		} else {
			payload = {
				deployments: data.deployments,
				properties: {
					gitHubInstallationId: this.gitHubInstallationId
				}
			};
		}
		this.logger.info({ gitHubProduct: this.gitHubProduct }, "Sending deployments payload to jira.");
		const response: AxiosResponse = await this.axios.post("/rest/deployments/0.1/bulk", payload);
		return {
			status: response.status,
			rejectedDeployments: response.data?.rejectedDeployments
		};
	}

	public async sendRemoteLink(data, options?: JiraSubmitOptions): Promise<AxiosResponse> {
		// Note: RemoteLinks doesn't have an issueKey field and takes in associations instead
		this.updateIssueKeyAssociationValuesFor(data.remoteLinks, uniq);
		if (!this.withinIssueKeyAssociationsLimit(data.remoteLinks)) {
			this.updateIssueKeyAssociationValuesFor(data.remoteLinks, this.truncate);
			const subscription = await Subscription.getSingleInstallation(jiraHost, this.gitHubInstallationId, this.gitHubAppId);
			await subscription?.update({ syncWarning: issueKeyLimitWarning });
		}
		let payload;
		if (await shouldTagBackfillRequests()) {
			payload = {
				remoteLinks: data.remoteLinks,
				properties: {
					gitHubInstallationId: this.gitHubInstallationId
				},
				preventTransitions: options?.preventTransitions || false,
				operationType: options?.operationType || "NORMAL"
			};
		} else {
			payload = {
				remoteLinks: data.remoteLinks,
				properties: {
					gitHubInstallationId: this.gitHubInstallationId
				}
			};
		}
		this.logger.info("Sending remoteLinks payload to jira.");
		return await this.axios.post("/rest/remotelinks/1.0/bulk", payload);
	}

	private updateIssueKeyAssociationValuesFor(resources: JiraRemoteLink[], mutatingFunc: any): JiraRemoteLink[] {
		resources?.forEach(resource => {
			const association = this.findIssueKeyAssociation(resource);
			if (association) {
				association.values = mutatingFunc(resource.associations[0].values);
			}
		});
		return resources;
	}

	private withinIssueKeyAssociationsLimit(resources: JiraRemoteLink[]): boolean {
		if (!resources) {
			return true;
		}

		const issueKeyCounts = resources.filter(resource => resource.associations?.length > 0).map((resource) => resource.associations[0].values.length);
		return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
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
		const dedupedCommits = this.dedupCommits(data.commits);

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

	private dedupIssueKeys(repositoryObj) {
		this.updateRepositoryIssueKeys(repositoryObj, uniq);
	}

	private truncateIssueKeys(repositoryObj) {
		this.updateRepositoryIssueKeys(repositoryObj, this.truncate);
	}

	private updateRepositoryIssueKeys(repositoryObj, mutatingFunc) {
		if (repositoryObj.commits) {
			repositoryObj.commits = this.updateIssueKeysFor(repositoryObj.commits, mutatingFunc);
		}

		if (repositoryObj.branches) {
			repositoryObj.branches = this.updateIssueKeysFor(repositoryObj.branches, mutatingFunc);
			repositoryObj.branches.forEach((branch) => {
				if (branch.lastCommit) {
					branch.lastCommit = this.updateIssueKeysFor([branch.lastCommit], mutatingFunc)[0];
				}
			});
		}

		if (repositoryObj.pullRequests) {
			repositoryObj.pullRequests = this.updateIssueKeysFor(repositoryObj.pullRequests, mutatingFunc);
		}
	}

	private updateIssueKeysFor(resources, func) {
		resources.forEach((r) => {
			if (r.issueKeys) {
				r.issueKeys = func(r.issueKeys);
			}
			const association = this.findIssueKeyAssociation(r);
			if (association) {
				association.values = func(association.values);
			}
		});
		return resources;
	}

	private findIssueKeyAssociation(resource: JiraIssueKeyObject): JiraAssociation | undefined {
		return resource.associations?.find(a => a.associationType == "issueIdOrKeys");
	}

	private truncate(array: string[]) {
		return array.slice(0, ISSUE_KEY_API_LIMIT);
	}

	private getTruncatedIssuekeys(data: JiraIssueKeyObject[] = []): JiraIssueKeyObject[] {
		return data.reduce((acc: JiraIssueKeyObject[], value: JiraIssueKeyObject) => {
			if (value?.issueKeys && value.issueKeys.length > ISSUE_KEY_API_LIMIT) {
				acc.push({
					issueKeys: value.issueKeys.slice(ISSUE_KEY_API_LIMIT)
				});
			}
			const association = this.findIssueKeyAssociation(value);
			if (association?.values && association.values.length > ISSUE_KEY_API_LIMIT) {
				acc.push({
					// TODO: Shouldn't it be association.values.slice(ISSUE_KEY_API_LIMIT), just as for issue key?!
					associations: [association]
				});
			}
			return acc;
		}, []);
	}

	private dedupCommits(commits: JiraCommit[] = []): JiraCommit[] {
		return commits.filter(
			(obj, pos, arr) =>
				arr.map((mapCommit) => mapCommit.id).indexOf(obj.id) === pos
		);
	}

	private withinIssueKeyLimit(resources: JiraIssueKeyObject[]): boolean {
		if (!resources) return true;
		const issueKeyCounts = resources.map((r) => r.issueKeys?.length || this.findIssueKeyAssociation(r)?.values?.length || 0);
		return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
	}
}
