/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { getAxiosInstance } from "./axios";
import { getJiraId } from "../util/id";
import { AxiosInstance, AxiosResponse } from "axios";
import Logger from "bunyan";
import { createHashWithSharedSecret } from "utils/encryption";
import {
	JiraAssociation,
	JiraBuildBulkSubmitData,
	JiraBuild,
	JiraDeployment,
	JiraCommit,
	JiraDeploymentBulkSubmitData,
	JiraIssue,
	JiraRemoteLink,
	JiraSubmitOptions,
	JiraVulnerabilityBulkSubmitData
} from "interfaces/jira";
import { getLogger } from "config/logger";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { uniq } from "lodash";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { TransformedRepositoryId, transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { getDeploymentDebugInfo } from "./jira-client-deployment-helper";
import {
	processAuditLogsForDevInfoBulkUpdate,
	processAuditLogsForWorkflowSubmit,
	processAuditLogsForDeploymentSubmit
} from "./jira-client-audit-log-helper";
import { BooleanFlags, booleanFlag } from "~/src/config/feature-flags";
import { sendAnalytics } from "~/src/util/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "~/src/interfaces/common";

// Max number of issue keys we can pass to the Jira API
export const ISSUE_KEY_API_LIMIT = 500;
export const issueKeyLimitWarning = "Exceeded issue key reference limit. Some issues may not be linked.";

export interface DeploymentsResult {
	status: number;
	rejectedDeployments?: any[];
}

export interface JiraClient {
	baseURL: string;
	issues: {
		get: (issueId: string, query?: { fields: string }) => Promise<AxiosResponse<JiraIssue>>;
		getAll: (issueIds: string[], query?: { fields: string }) => Promise<JiraIssue[]>;
		parse: (text: string) => string[] | undefined;
		comments: {
			list: (issue_id: string) => any;
			addForIssue: (issue_id: string, payload: any) => any;
			updateForIssue: (issue_id: string, comment_id: string, payload: any) => any;
			deleteForIssue: (issue_id: string, comment_id: string) => any;
		};
		transitions: {
			getForIssue: (issue_id: string) => any;
			updateForIssue: (issue_id: string, transition_id: string) => any;
		};
		worklogs: {
			addForIssue: (issue_id: string, payload: any) => any;
		};
	};
	devinfo: {
		branch: {
			delete: (transformedRepositoryId: TransformedRepositoryId, branchRef: string) => any;
		};
		installation: {
			delete: (gitHubInstallationId: string | number) => Promise<any[]>;
		};
		pullRequest: {
			delete: (transformedRepositoryId: TransformedRepositoryId, pullRequestId: string) => any;
		};
		repository: {
			delete: (repositoryId: number, gitHubBaseUrl?: string) => Promise<any[]>;
			update: (data: any, options?: JiraSubmitOptions) => any;
		},
	},
	workflow: {
		submit: (data: JiraBuildBulkSubmitData, repositoryId: number, repoFullName: string, options: JiraSubmitOptions) => Promise<any>;
	},
	deployment: {
		submit: (
			data: JiraDeploymentBulkSubmitData,
			repositoryId: number,
			options?: JiraSubmitOptions
		) => Promise<DeploymentsResult>;
	},
	remoteLink: {
		submit: (data: any, options?: JiraSubmitOptions) => Promise<AxiosResponse>;
	},
	security: {
		submitVulnerabilities: (data: JiraVulnerabilityBulkSubmitData, options?: JiraSubmitOptions) => Promise<AxiosResponse>;
	}
}

/*
 * Similar to the existing Octokit rest.js instance included in probot
 * apps by default, this client adds a Jira client that allows us to
 * abstract away the underlying HTTP requests made for each action. In
 * general, the client should match the Octokit rest.js design for clear
 * interoperability.
 */

// TODO: need to type jiraClient ASAP
export const getJiraClient = async (
	jiraHost: string,
	gitHubInstallationId: number,
	gitHubAppId: number | undefined,
	log: Logger = getLogger("jira-client")
): Promise<JiraClient | undefined> => {
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);
	const logger = log.child({ jiraHost, gitHubInstallationId, gitHubProduct });
	const installation = await Installation.getForHost(jiraHost);

	if (!installation) {
		logger.warn("Cannot initialize Jira Client, Installation doesn't exist.");
		return undefined;
	}

	let subscription;
	if (await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost)) {
		subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId, gitHubAppId);
		if (!subscription) {
			logger.warn("Cannot initialize Jira Client, Subscription doesn't exist.");
			return undefined;
		}
	}

	const instance = getAxiosInstance(
		installation.jiraHost,
		await installation.decrypt("encryptedSharedSecret", logger),
		logger
	);

	// TODO: need to create actual class for this
	const client: JiraClient = {
		baseURL: installation.jiraHost,
		issues: {
			get: (issueId: string, query = { fields: "summary" }): Promise<AxiosResponse<JiraIssue>> =>
				instance.get("/rest/api/latest/issue/{issue_id}", {
					params: query,
					urlParams: {
						issue_id: issueId
					}
				}),
			getAll: async (issueIds: string[], query?: { fields: string }): Promise<JiraIssue[]> => {
				const responses = await Promise.all<AxiosResponse<JiraIssue> | undefined>(
					issueIds.map((issueId) => client.issues.get(issueId, query)
						// Ignore any errors
						.catch(() => undefined))
				);
				return responses.reduce((acc: JiraIssue[], response) => {
					if (response?.status === 200 && !!response?.data) {
						acc.push(response.data);
					}
					return acc;
				}, []);
			},
			parse: (text: string): string[] | undefined => {
				if (!text) return undefined;
				return jiraIssueKeyParser(text);
			},
			comments: {
				// eslint-disable-next-line camelcase
				list: (issue_id: string) =>
					instance.get("/rest/api/latest/issue/{issue_id}/comment?expand=properties", {
						urlParams: {
							issue_id
						}
					}),
				addForIssue: (issue_id: string, payload) =>
					instance.post("/rest/api/3/issue/{issue_id}/comment", payload, {
						urlParams: {
							issue_id
						},
						headers: {
							"accept": "application/json",
							"content-type": "application/json"
						}
					}),
				updateForIssue: (issue_id: string, comment_id: string, payload) =>
					instance.put("rest/api/3/issue/{issue_id}/comment/{comment_id}", payload, {
						urlParams: {
							issue_id,
							comment_id
						},
						headers: {
							"accept": "application/json",
							"content-type": "application/json"
						}
					}),
				deleteForIssue: (issue_id: string, comment_id: string) =>
					instance.delete("rest/api/latest/issue/{issue_id}/comment/{comment_id}", {
						urlParams: {
							issue_id,
							comment_id
						}
					})
			},
			transitions: {
				// eslint-disable-next-line camelcase
				getForIssue: (issue_id: string) =>
					instance.get("/rest/api/latest/issue/{issue_id}/transitions", {
						urlParams: {
							issue_id
						}
					}),
				// eslint-disable-next-line camelcase
				updateForIssue: (issue_id: string, transition_id: string) =>
					instance.post(
						"/rest/api/latest/issue/{issue_id}/transitions",
						{
							transition: {
								id: transition_id
							}
						},
						{
							urlParams: {
								issue_id
							}
						}
					)
			},
			worklogs: {
				// eslint-disable-next-line camelcase
				addForIssue: (issue_id: string, payload) =>
					instance.post("/rest/api/latest/issue/{issue_id}/worklog", payload, {
						urlParams: {
							issue_id
						}
					})
			}
		},
		devinfo: {
			branch: {
				delete: (transformedRepositoryId: TransformedRepositoryId, branchRef: string) =>
					instance.delete(
						"/rest/devinfo/0.10/repository/{transformedRepositoryId}/branch/{branchJiraId}",
						{
							params: {
								_updateSequenceId: Date.now()
							},
							urlParams: {
								transformedRepositoryId,
								branchJiraId: getJiraId(branchRef)
							}
						}
					)
			},
			// Add methods for handling installationId properties that exist in Jira
			installation: {
				delete: async (gitHubInstallationId: string | number) =>
					Promise.all([

						// We are sending devinfo events with the property "installationId", so we delete by this property.
						instance.delete(
							"/rest/devinfo/0.10/bulkByProperties",
							{
								params: {
									installationId: gitHubInstallationId
								}
							}
						).then(response => {
							log.info({
								debugging: {
									gitHubInstallationId,
									status: response.status,
									statusText: response.statusText,
									headers: response.headers
								}
							},
							"Debugging pollinator: Delete succeeded"
							);
							return Promise.resolve(response);
						}).catch(err => {
							log.info({
								gitHubInstallationId,
								err
							}, "Debugging pollinator: Delete failed");
							return Promise.reject(err);
						}),

						// We are sending build events with the property "gitHubInstallationId", so we delete by this property.
						instance.delete(
							"/rest/builds/0.1/bulkByProperties",
							{
								params: {
									gitHubInstallationId
								}
							}
						),

						// We are sending deployments events with the property "gitHubInstallationId", so we delete by this property.
						instance.delete(
							"/rest/deployments/0.1/bulkByProperties",
							{
								params: {
									gitHubInstallationId
								}
							}
						)
					])
			},
			pullRequest: {
				delete: (transformedRepositoryId: TransformedRepositoryId, pullRequestId: string) =>
					instance.delete(
						"/rest/devinfo/0.10/repository/{transformedRepositoryId}/pull_request/{pullRequestId}",
						{
							params: {
								_updateSequenceId: Date.now()
							},
							urlParams: {
								transformedRepositoryId,
								pullRequestId
							}
						}
					)
			},
			repository: {
				delete: async (repositoryId: number, gitHubBaseUrl?: string) => {
					const transformedRepositoryId = transformRepositoryId(repositoryId, gitHubBaseUrl);
					return Promise.all([
						// We are sending devinfo events with the property "transformedRepositoryId", so we delete by this property.
						instance.delete("/rest/devinfo/0.10/repository/{transformedRepositoryId}",
							{
								params: {
									_updateSequenceId: Date.now()
								},
								urlParams: {
									transformedRepositoryId
								}
							}
						),

						// We are sending build events with the property "repositoryId", so we delete by this property.
						instance.delete(
							"/rest/builds/0.1/bulkByProperties",
							{
								params: {
									repositoryId
								}
							}
						),

						// We are sending deployments events with the property "repositoryId", so we delete by this property.
						instance.delete(
							"/rest/deployments/0.1/bulkByProperties",
							{
								params: {
									repositoryId
								}
							}
						)
					]);
				},
				update: async (data, options?: JiraSubmitOptions) => {
					dedupIssueKeys(data);
					if (
						!withinIssueKeyLimit(data.commits) ||
						!withinIssueKeyLimit(data.branches) ||
						!withinIssueKeyLimit(data.pullRequests)
					) {
						logger.warn({
							truncatedCommitsCount: getTruncatedIssuekeys(data.commits).length,
							truncatedBranchesCount: getTruncatedIssuekeys(data.branches).length,
							truncatedPRsCount: getTruncatedIssuekeys(data.pullRequests).length
						}, issueKeyLimitWarning);
						truncateIssueKeys(data);
						const subscription = await Subscription.getSingleInstallation(
							jiraHost,
							gitHubInstallationId,
							gitHubAppId
						);
						await subscription?.update({ syncWarning: issueKeyLimitWarning });
					}

					return batchedBulkUpdate(
						data,
						instance,
						gitHubInstallationId,
						logger,
						options,
						jiraHost
					);
				}
			}
		},
		workflow: {
			submit: async (data: JiraBuildBulkSubmitData, repositoryId: number, repoFullName: string, options: JiraSubmitOptions) => {
				updateIssueKeysFor(data.builds, uniq);
				if (!withinIssueKeyLimit(data.builds)) {
					logger.warn({
						truncatedBuilds: getTruncatedIssuekeys(data.builds)
					}, issueKeyLimitWarning);
					updateIssueKeysFor(data.builds, truncate);
					const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId, gitHubAppId);
					await subscription?.update({ syncWarning: issueKeyLimitWarning });
				}

				const payload = {
					builds: data.builds,
					properties: {
						gitHubInstallationId,
						repositoryId
					},
					providerMetadata: {
						product: data.product
					},
					preventTransitions: options?.preventTransitions || false,
					operationType: options?.operationType || "NORMAL"
				};

				logger.info("Posting backfill workflow info for " , { repositoryId, repoFullName, data });
				const response =  await instance.post("/rest/builds/0.1/bulk", payload);
				const responseData = {
					status: response.status,
					data: response.data
				};
				const reqBuildDataArray: JiraBuild[] = data?.builds || [];
				if (await booleanFlag(BooleanFlags.USE_DYNAMODB_TO_PERSIST_AUDIT_LOG, jiraHost)) {
					processAuditLogsForWorkflowSubmit({ reqBuildDataArray, repoFullName, response:responseData, options, logger });
				}
				return response;
			}
		},
		deployment: {
			submit: async (data: JiraDeploymentBulkSubmitData, repositoryId: number, options?: JiraSubmitOptions): Promise<DeploymentsResult> => {
				updateIssueKeysFor(data.deployments, uniq);
				if (!withinIssueKeyLimit(data.deployments)) {
					logger.warn({
						truncatedDeployments: getTruncatedIssuekeys(data.deployments)
					}, issueKeyLimitWarning);
					updateIssueKeysFor(data.deployments, truncate);
					const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId, gitHubAppId);
					await subscription?.update({ syncWarning: issueKeyLimitWarning });
				}
				const payload = {
					deployments: data.deployments,
					properties: {
						gitHubInstallationId,
						repositoryId
					},
					preventTransitions: options?.preventTransitions || false,
					operationType: options?.operationType || "NORMAL"
				};

				logger?.info({ gitHubProduct, ...extractDeploymentDataForLoggingPurpose(data, logger) }, "Sending deployments payload to jira.");
				const response: AxiosResponse = await instance.post("/rest/deployments/0.1/bulk", payload);

				if (
					response.data?.rejectedDeployments?.length ||
					response.data?.unknownIssueKeys?.length ||
					response.data?.unknownAssociations?.length
				) {
					logger.warn({
						acceptedDeployments: response.data?.acceptedDeployments,
						rejectedDeployments: response.data?.rejectedDeployments,
						unknownIssueKeys: response.data?.unknownIssueKeys,
						unknownAssociations: response.data?.unknownAssociations,
						options,
						...getDeploymentDebugInfo(data)
					}, "Jira API rejected deployment!");
				} else {
					logger.info({
						acceptedDeployments: response.data?.acceptedDeployments,
						options,
						...getDeploymentDebugInfo(data)
					}, "Jira API accepted deployment!");
					const responseData = {
						status: response.status,
						data: response.data
					};
					const reqDeploymentDataArray: JiraDeployment[] = data?.deployments || [];
					if (await booleanFlag(BooleanFlags.USE_DYNAMODB_TO_PERSIST_AUDIT_LOG, jiraHost)) {
						processAuditLogsForDeploymentSubmit({ reqDeploymentDataArray, response:responseData, options, logger });
					}

				}
				return {
					status: response.status,
					rejectedDeployments: response.data?.rejectedDeployments
				};
			}
		},
		remoteLink: {
			submit: async (data, options?: JiraSubmitOptions) => {

				// Note: RemoteLinks doesn't have an issueKey field and takes in associations instead
				updateIssueKeyAssociationValuesFor(data.remoteLinks, uniq);
				if (!withinIssueKeyAssociationsLimit(data.remoteLinks)) {
					updateIssueKeyAssociationValuesFor(data.remoteLinks, truncate);
					const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId, gitHubAppId);
					await subscription?.update({ syncWarning: issueKeyLimitWarning });
				}
				const payload = {
					remoteLinks: data.remoteLinks,
					properties: {
						gitHubInstallationId
					},
					preventTransitions: options?.preventTransitions || false,
					operationType: options?.operationType || "NORMAL"
				};
				logger.info("Sending remoteLinks payload to jira.");
				return await instance.post("/rest/remotelinks/1.0/bulk", payload);
			}
		},
		security: {
			submitVulnerabilities: async (data, options?: JiraSubmitOptions): Promise<AxiosResponse> => {
				const payload = {
					vulnerabilities: data.vulnerabilities,
					properties: {
						gitHubInstallationId,
						workspaceId: subscription?.id
					},
					operationType: options?.operationType || "NORMAL"
				};
				logger.info("Sending vulnerabilities payload to jira.");
				const response = await instance.post("/rest/security/1.0/bulk", payload);
				handleSubmitVulnerabilitiesResponse(response, logger);
				await sendAnalytics(installation.jiraHost, AnalyticsEventTypes.TrackEvent, {
					action: AnalyticsTrackEventsEnum.GitHubSecurityVulnerabilitiesSubmittedEventName,
					actionSubject: AnalyticsTrackEventsEnum.GitHubSecurityVulnerabilitiesSubmittedEventName,
					source: !subscription.gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise
				}, {
					jiraHost: installation.jiraHost,
					operationType: options?.operationType || "NORMAL",
					workspaceId: subscription?.id,
					count: data.vulnerabilities?.length
				});
				return response;
			}
		}
	};

	return client;
};

const handleSubmitVulnerabilitiesResponse = (response: AxiosResponse, logger: Logger) => {
	const rejectedEntities = response.data?.rejectedEntities;
	if (rejectedEntities?.length > 0) {
		logger.warn({ rejectedEntities }, `Data depot rejected ${rejectedEntities.length as number} vulnerabilities`);
	}
};

const extractDeploymentDataForLoggingPurpose = (data: JiraDeploymentBulkSubmitData, logger: Logger): Record<string, any> => {
	try {
		return {
			deployments: (data.deployments || []).map(deployment => ({
				updateSequenceNumber: deployment.updateSequenceNumber,
				state: createHashWithSharedSecret(deployment.state),
				url: createHashWithSharedSecret(deployment.url),
				issueKeys: (deployment.associations || [])
					.filter(a => ["issueKeys", "issueIdOrKeys", "serviceIdOrKeys"].includes(a.associationType))
					.flatMap(a => (a.values as string[] || []).map((v: string) => createHashWithSharedSecret(v)))
			}))
		};
	} catch (error: unknown) {
		logger.error({ error }, "Fail extractDeploymentDataForLoggingPurpose");
		return {};
	}
};

/**
 * Splits commits in data payload into chunks of 400 and makes separate requests
 * to avoid Jira API limit
 */
const batchedBulkUpdate = async (
	data,
	instance: AxiosInstance,
	installationId: number | undefined,
	logger: Logger,
	options?: JiraSubmitOptions,
	jiraHost?: string
) => {
	const dedupedCommits = dedupCommits(data.commits);
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
		const responseData = {
			status: response.status,
			data:response.data
		};

		if (await booleanFlag(BooleanFlags.USE_DYNAMODB_TO_PERSIST_AUDIT_LOG, jiraHost)) {
			processAuditLogsForDevInfoBulkUpdate({ reqRepoData:data, response:responseData, options, logger });
		}

		logger.info({
			responseStatus: response.status,
			unknownIssueKeys: safeParseAndHashUnknownIssueKeysForLoggingPurpose(response.data, logger)
		}, "Jira devinfo bulk update api returned");

		return response;
	});
	return Promise.all(batchedUpdates);
};

const extractAndHashIssueKeysForLoggingPurpose = (commitChunk: JiraCommit[], logger: Logger): string[] => {
	try {
		return commitChunk
			.flatMap((chunk: JiraCommit) => chunk.issueKeys)
			.filter(key => !!key)
			.map((key: string) => createHashWithSharedSecret(key));
	} catch (error: unknown) {
		logger.error({ error }, "Fail extract and hash issue keys before sending to jira");
		return [];
	}
};

const safeParseAndHashUnknownIssueKeysForLoggingPurpose = (responseData: any, logger: Logger): string[] => {
	try {
		return (responseData["unknownIssueKeys"] || []).map((key: string) => createHashWithSharedSecret(key));
	} catch (error: unknown) {
		logger.error({ error }, "Error parsing unknownIssueKeys from jira api response");
		return [];
	}
};

const findIssueKeyAssociation = (resource: IssueKeyObject): JiraAssociation | undefined =>
	resource.associations?.find(a => a.associationType == "issueIdOrKeys");

/**
 * Returns if the max length of the issue
 * key field is within the limit
 */
const withinIssueKeyLimit = (resources: IssueKeyObject[]): boolean => {
	if (!resources) return true;
	const issueKeyCounts = resources.map((r) => r.issueKeys?.length || findIssueKeyAssociation(r)?.values?.length || 0);
	return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
};

/**
 * Returns if the max length of the issue key field is within the limit
 * Assumption is that the transformed resource only has one association which is for
 * "issueIdOrKeys" association.
 */
const withinIssueKeyAssociationsLimit = (resources: JiraRemoteLink[]): boolean => {
	if (!resources) {
		return true;
	}

	const issueKeyCounts = resources.filter(resource => resource.associations?.length > 0).map((resource) => resource.associations[0].values.length);
	return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
};

/**
 * Deduplicates commits by ID field for a repository payload
 */
const dedupCommits = (commits: JiraCommit[] = []): JiraCommit[] =>
	commits.filter(
		(obj, pos, arr) =>
			arr.map((mapCommit) => mapCommit.id).indexOf(obj.id) === pos
	);

/**
 * Deduplicates issueKeys field for branches and commits
 */
const dedupIssueKeys = (repositoryObj) => {
	updateRepositoryIssueKeys(repositoryObj, uniq);
};

/**
 * Truncates branches, commits and PRs to their first 100 issue keys
 */
const truncateIssueKeys = (repositoryObj) => {
	updateRepositoryIssueKeys(repositoryObj, truncate);
};

interface IssueKeyObject {
	issueKeys?: string[];
	associations?: JiraAssociation[];
}

// TODO: add unit tests
export const getTruncatedIssuekeys = (data: IssueKeyObject[] = []): IssueKeyObject[] =>
	data.reduce((acc: IssueKeyObject[], value: IssueKeyObject) => {
		if (value?.issueKeys && value.issueKeys.length > ISSUE_KEY_API_LIMIT) {
			acc.push({
				issueKeys: value.issueKeys.slice(ISSUE_KEY_API_LIMIT)
			});
		}
		const association = findIssueKeyAssociation(value);
		if (association?.values && association.values.length > ISSUE_KEY_API_LIMIT) {
			acc.push({
				// TODO: Shouldn't it be association.values.slice(ISSUE_KEY_API_LIMIT), just as for issue key?!
				associations: [association]
			});
		}
		return acc;
	}, []);

/**
 * Runs a mutating function on all branches, commits and PRs
 * with issue keys in a Jira Repository object
 */
const updateRepositoryIssueKeys = (repositoryObj, mutatingFunc) => {
	if (repositoryObj.commits) {
		repositoryObj.commits = updateIssueKeysFor(repositoryObj.commits, mutatingFunc);
	}

	if (repositoryObj.branches) {
		repositoryObj.branches = updateIssueKeysFor(repositoryObj.branches, mutatingFunc);
		repositoryObj.branches.forEach((branch) => {
			if (branch.lastCommit) {
				branch.lastCommit = updateIssueKeysFor([branch.lastCommit], mutatingFunc)[0];
			}
		});
	}

	if (repositoryObj.pullRequests) {
		repositoryObj.pullRequests = updateIssueKeysFor(repositoryObj.pullRequests, mutatingFunc);
	}
};

/**
 * Runs the mutatingFunc on the issue keys field for each branch, commit or PR
 */
const updateIssueKeysFor = (resources, func) => {
	resources.forEach((r) => {
		if (r.issueKeys) {
			r.issueKeys = func(r.issueKeys);
		}
		const association = findIssueKeyAssociation(r);
		if (association) {
			association.values = func(association.values);
		}
	});
	return resources;
};

/**
 * Runs the mutatingFunc on the association values field for each entity resource
 * Assumption is that the transformed resource only has one association which is for
 * "issueIdOrKeys" association.
 */
const updateIssueKeyAssociationValuesFor = (resources: JiraRemoteLink[], mutatingFunc: any): JiraRemoteLink[] => {
	resources?.forEach(resource => {
		const association = findIssueKeyAssociation(resource);
		if (association) {
			association.values = mutatingFunc(resource.associations[0].values);
		}
	});
	return resources;
};

/**
 * Truncates to 100 elements in an array
 */
const truncate = (array) => array.slice(0, ISSUE_KEY_API_LIMIT);
