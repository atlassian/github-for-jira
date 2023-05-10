/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { getAxiosInstance } from "./axios";
import { getJiraId } from "../util/id";
import { AxiosInstance, AxiosResponse } from "axios";
import Logger from "bunyan";

import {
	JiraAssociation,
	JiraBuildBulkSubmitData,
	JiraCommit,
	JiraDeploymentBulkSubmitData,
	JiraIssue,
	JiraRemoteLink,
	JiraSubmitOptions
} from "interfaces/jira";
import { getLogger } from "config/logger";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { uniq } from "lodash";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { TransformedRepositoryId, transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { getDeploymentDebugInfo } from "./jira-client-deployment-helper";

// Max number of issue keys we can pass to the Jira API
export const ISSUE_KEY_API_LIMIT = 100;
const issueKeyLimitWarning = "Exceeded issue key reference limit. Some issues may not be linked.";

export interface DeploymentsResult {
	status: number;
	rejectedDeployments?: any[];
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
): Promise<any> => {
	const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);
	const logger = log.child({ jiraHost, gitHubInstallationId, gitHubProduct });
	const installation = await Installation.getForHost(jiraHost);

	if (!installation) {
		logger.warn("Cannot initialize Jira Client, Installation doesn't exist.");
		return undefined;
	}
	const instance = getAxiosInstance(
		installation.jiraHost,
		await installation.decrypt("encryptedSharedSecret", logger),
		logger
	);

	// TODO: need to create actual class for this
	const client = {
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
					instance.post("/rest/api/latest/issue/{issue_id}/comment", payload, {
						urlParams: {
							issue_id
						}
					}),
				updateForIssue: (issue_id: string, comment_id: string, payload) =>
					instance.put("rest/api/latest/issue/{issue_id}/comment/{comment_id}", payload, {
						urlParams: {
							issue_id,
							comment_id
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
						),

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
						options
					);
				}
			}
		},
		workflow: {
			submit: async (data: JiraBuildBulkSubmitData, repositoryId: number, options?: JiraSubmitOptions) => {
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

				logger?.info({ gitHubProduct }, "Sending builds payload to jira.");
				return await instance.post("/rest/builds/0.1/bulk", payload);
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
				const	payload = {
					deployments: data.deployments,
					properties: {
						gitHubInstallationId,
						repositoryId
					},
					preventTransitions: options?.preventTransitions || false,
					operationType: options?.operationType || "NORMAL"
				};

				logger?.info({ gitHubProduct }, "Sending deployments payload to jira.");
				const response: AxiosResponse = await instance.post("/rest/deployments/0.1/bulk", payload);

				if (response.data?.rejectedDeployments?.length) {
					logger.warn({
						rejectedDeployments: response.data?.rejectedDeployments,
						options,
						...getDeploymentDebugInfo(data)
					}, "Jira API rejected deployment!");
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
				const	payload = {
					remoteLinks: data.remoteLinks,
					properties: {
						gitHubInstallationId
					},
					preventTransitions: options?.preventTransitions || false,
					operationType: options?.operationType || "NORMAL"
				};
				logger.info("Sending remoteLinks payload to jira.");
				await instance.post("/rest/remotelinks/1.0/bulk", payload);
			}
		}
	};

	return client;
};

/**
 * Splits commits in data payload into chunks of 400 and makes separate requests
 * to avoid Jira API limit
 */
const batchedBulkUpdate = async (
	data,
	instance: AxiosInstance,
	installationId: number | undefined,
	options?: JiraSubmitOptions
) => {
	const dedupedCommits = dedupCommits(data.commits);
	// Initialize with an empty chunk of commits so we still process the request if there are no commits in the payload
	const commitChunks: JiraCommit[][] = [];
	do {
		commitChunks.push(dedupedCommits?.splice(0, 400));
	} while (dedupedCommits.length);

	const batchedUpdates = commitChunks.map((commitChunk) => {
		if (commitChunk.length) {
			data.commits = commitChunk;
		}
		const	body = {
			preventTransitions: options?.preventTransitions || false,
			operationType: options?.operationType || "NORMAL",
			repositories: [data],
			properties: {
				installationId
			}
		};

		return instance.post("/rest/devinfo/0.10/bulk", body);
	});
	return Promise.all(batchedUpdates);
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
