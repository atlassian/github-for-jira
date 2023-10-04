import { uniq } from "lodash";
import Logger from "bunyan";
import { createHashWithSharedSecret } from "utils/encryption";
import {
	JiraAssociation,
	JiraCommit,
	JiraRemoteLink
} from "interfaces/jira";

export interface IssueKeyObject {
	issueKeys?: string[];
	associations?: JiraAssociation[];
}

// Max number of issue keys we can pass to the Jira API
export const ISSUE_KEY_API_LIMIT = 500;

/**
 * Truncates to ISSUE_KEY_API_LIMIT elements in an array
 */
export const truncate = (array: unknown[]) => {
	return array.slice(0, ISSUE_KEY_API_LIMIT);
};

/**
 * Truncates branches, commits and PRs to their first ISSUE_KEY_API_LIMIT issue keys
 */
export const truncateIssueKeys = (repositoryObj) => {
	updateRepositoryIssueKeys(repositoryObj, truncate);
};

/**
 * Get truncated issue keys and associations based on the ISSUE_KEY_API_LIMIT.
 */
export const getTruncatedIssueKeys = (data: IssueKeyObject[] = []): IssueKeyObject[] =>
	data.map((value: IssueKeyObject) => {
		const truncatedValue: IssueKeyObject = {};

		if (value?.issueKeys) {
			truncatedValue.issueKeys = value.issueKeys.slice(0, ISSUE_KEY_API_LIMIT);
		}

		const association = findIssueKeyAssociation(value);
		if (association?.values) {
			truncatedValue.associations = [
				{
					associationType: association.associationType,
					values: association.values.slice(0, ISSUE_KEY_API_LIMIT)
				}
			];
		}

		return truncatedValue;
	});

/**
 * Returns if the max length of the issue key field is within the limit
 */
export const withinIssueKeyLimit = (resources: IssueKeyObject[]): boolean => {
	if (!resources) return true;
	const issueKeyCounts = resources.map((r) => r.issueKeys?.length || findIssueKeyAssociation(r)?.values?.length || 0);
	return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
};

/**
 * Deduplicates issueKeys field for branches and commits
 */
export const dedupIssueKeys = (repositoryObj) => {
	updateRepositoryIssueKeys(repositoryObj, uniq);
};

/**
 * Runs a mutating function on all branches, commits and PRs
 * with issue keys in a Jira Repository object
 */
export const updateRepositoryIssueKeys = (repositoryObj, mutatingFunc) => {
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
 * Finds the first association of type "issueIdOrKeys" in a given resource.
 */
export const findIssueKeyAssociation = (resource: IssueKeyObject): JiraAssociation | undefined => {
	return resource.associations?.find(a => a.associationType == "issueIdOrKeys");
};

/**
 * Runs the mutatingFunc on the issue keys field for each branch, commit or PR
 */
export const updateIssueKeysFor = (resources, func) => {
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
export const updateIssueKeyAssociationValuesFor = (resources: JiraRemoteLink[], mutatingFunc: any): JiraRemoteLink[] => {
	resources?.forEach(resource => {
		const association = findIssueKeyAssociation(resource);
		if (association) {
			association.values = mutatingFunc(resource.associations[0].values);
		}
	});
	return resources;
};

/**
 * Returns if the max length of the issue key field is within the limit
 * Assumption is that the transformed resource only has one association which is for
 * "issueIdOrKeys" association.
 */
export const withinIssueKeyAssociationsLimit = (resources: JiraRemoteLink[]): boolean => {
	if (!resources) {
		return true;
	}

	const issueKeyCounts = resources.filter(resource => resource.associations?.length > 0).map((resource) => resource.associations[0].values.length);
	return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
};

/**
 * Extracts unique issue keys and hashes them
 */
export const extractAndHashIssueKeysForLoggingPurpose = (commitChunk: JiraCommit[], logger: Logger): string[] => {
	try {
		return commitChunk
			.flatMap((chunk: JiraCommit) => chunk.issueKeys)
			.filter(key => !!key)
			.map((key: string) => createHashWithSharedSecret(key));
	} catch (error) {
		logger.error({ error }, "Fail extract and hash issue keys before sending to jira");
		return [];
	}
};

/**
 * hash unknown issue keys
 */
export const safeParseAndHashUnknownIssueKeysForLoggingPurpose = (responseData: any, logger: Logger): string[] => {
	try {
		return (responseData["unknownIssueKeys"] || []).map((key: string) => createHashWithSharedSecret(key));
	} catch (error) {
		logger.error({ error }, "Error parsing unknownIssueKeys from jira api response");
		return [];
	}
};
