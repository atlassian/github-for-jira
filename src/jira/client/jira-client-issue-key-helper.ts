
import { uniq } from "lodash";
import { createHashWithSharedSecret } from "utils/encryption";
import {
	JiraAssociation,
	JiraCommit,
	JiraRemoteLink
} from "interfaces/jira";

interface IssueKeyObject {
	issueKeys?: string[];
	associations?: JiraAssociation[];
}

import Logger from "bunyan";

// Max number of issue keys we can pass to the Jira API
export const ISSUE_KEY_API_LIMIT = 500;

/**
 * Truncates to 100 elements in an array
 */
export const truncate = (array) => array.slice(0, ISSUE_KEY_API_LIMIT);

/**
 * Truncates branches, commits and PRs to their first 100 issue keys
 */
export const truncateIssueKeys = (repositoryObj) => {
	updateRepositoryIssueKeys(repositoryObj, truncate);
};


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
 * Returns if the max length of the issue
 * key field is within the limit
 */
export const withinIssueKeyLimit = (resources: IssueKeyObject[]): boolean => {
	if (!resources) return true;
	const issueKeyCounts = resources.map((r) => r.issueKeys?.length || findIssueKeyAssociation(r)?.values?.length || 0);
	return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
};

//// TO BE BNROKEN INTO A UTILS FILE
/**
 * Deduplicates issueKeys field for branches and commits
 */
export const dedupIssueKeys = (repositoryObj) => {
	updateRepositoryIssueKeys(repositoryObj, uniq);
};


const findIssueKeyAssociation = (resource: IssueKeyObject): JiraAssociation | undefined =>
	resource.associations?.find(a => a.associationType == "issueIdOrKeys");

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

export const safeParseAndHashUnknownIssueKeysForLoggingPurpose = (responseData: any, logger: Logger): string[] => {
	try {
		return (responseData["unknownIssueKeys"] || []).map((key: string) => createHashWithSharedSecret(key));
	} catch (error) {
		logger.error({ error }, "Error parsing unknownIssueKeys from jira api response");
		return [];
	}
};