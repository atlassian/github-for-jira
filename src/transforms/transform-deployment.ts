import Logger from "bunyan";
import { JiraAssociation, JiraDeploymentData } from "interfaces/jira";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import {
	CommitSummary,
	extractMessagesFromCommitSummaries,
	getAllCommitsBetweenReferences
} from "./util/github-api-requests";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { AxiosResponse } from "axios";
import { deburr, isEmpty } from "lodash";
import { jiraIssueKeyParser } from "utils/jira-utils";

const MAX_ASSOCIATIONS_PER_ENTITY = 500;

// https://docs.github.com/en/rest/reference/repos#list-deployments
const getLastSuccessfulDeployCommitSha = async(
	owner: string,
	repoName: string,
	githubInstallationClient: GitHubInstallationClient,
	deployments: Octokit.ReposListDeploymentsResponseItem[],
	logger?: Logger
): Promise<string> => {

	try {
		for (const deployment of deployments) {
			// Get each deployment status for this environment so we can have their statuses' ids
			const listDeploymentStatusResponse: Octokit.Response<Octokit.ReposListDeploymentStatusesResponse> | AxiosResponse<Octokit.ReposListDeploymentStatusesResponse> =
				await githubInstallationClient.listDeploymentStatuses(owner, repoName, deployment.id, 100);
			// Find the first successful one
			const lastSuccessful: Octokit.ReposListDeploymentStatusesResponseItem | undefined = listDeploymentStatusResponse.data.find(deployment => deployment.state === "success");
			if (lastSuccessful !== undefined) {
				return deployment.sha;
			}
		}
	} catch (e) {
		logger?.error(`Failed to get deployment statuses.`);
	}

	// If there's no successful deployment on the list of deployments that GitHub returned us (max. 100) then we'll return the last one from the array, even if it's a failed one.
	return deployments[deployments.length - 1].sha;
};

const getCommitsSinceLastSuccessfulDeployment = async(
	owner: string,
	repoName: string,
	currentDeploySha: string,
	currentDeployId: number,
	currentDeployEnv: string,
	githubInstallationClient: GitHubInstallationClient,
	logger: Logger
): Promise<CommitSummary[] | undefined> => {

	// Grab the last 10 deployments for this repo
	const deployments: Octokit.Response<Octokit.ReposListDeploymentsResponse> | AxiosResponse<Octokit.ReposListDeploymentsResponse> =
		await githubInstallationClient.listDeployments(owner, repoName, currentDeployEnv, 10);

	// Filter per current environment and exclude itself
	const filteredDeployments = deployments.data
		.filter(deployment => deployment.id !== currentDeployId);

	// If this is the very first successful deployment ever, return nothing because we won't have any commit sha to compare with the current one.
	if (!filteredDeployments.length) {
		return undefined;
	}

	const lastSuccessfullyDeployedCommit = await getLastSuccessfulDeployCommitSha(owner, repoName, githubInstallationClient, filteredDeployments, logger);

	const compareCommitsPayload = {
		owner: owner,
		repo: repoName,
		base: lastSuccessfullyDeployedCommit,
		head: currentDeploySha
	};

	return await getAllCommitsBetweenReferences(
		compareCommitsPayload,
		githubInstallationClient,
		logger
	);
};

// We need to map the state of a GitHub deployment back to a valid deployment state in Jira.
// https://docs.github.com/en/rest/reference/repos#list-deployments
// Deployment state - GitHub: Can be one of error, failure, pending, in_progress, queued, or success
// https://developer.atlassian.com/cloud/jira/software/rest/api-group-builds/#api-deployments-0-1-bulk-post
// Deployment state - Jira: Can be one of unknown, pending, in_progress, cancelled, failed, rolled_back, successful
const mapState = (state: string | undefined): string => {
	switch (state?.toLowerCase()) {
		case "queued":
			return "pending";
		// We send "pending" as "in progress" because the GitHub API goes Pending -> Success (there's no in progress update).
		// For users, it's a better UI experience if they see In progress instead of Pending, because the deployment might be running already.
		case "pending":
		case "in_progress":
			return "in_progress";
		case "success":
			return "successful";
		case "error":
		case "failure":
			return "failed";
		default:
			return "unknown";
	}
};

// We need to map the environment of a GitHub deployment back to a valid deployment environment in Jira.
// https://docs.github.com/en/actions/reference/environments
// GitHub: does not have pre-defined values and users can name their environments whatever they like. We try to map as much as we can here and log the unmapped ones.
// Jira: Can be one of unmapped, development, testing, staging, production
export const mapEnvironment = (environment: string): string => {
	const isEnvironment = (envNames: string[]): boolean => {
		// Matches any of the input names exactly
		const exactMatch = envNames.join("|");
		// Matches separators within environment names, e.g. "-" in "prod-east" or ":" in "test:mary"
		const separator = "[^a-z0-9]";
		// Matches an optional prefix, followed by one of the input names, followed by an optional suffix.
		// This lets us match variants, e.g. "prod-east" and "prod-west" are considered variants of "prod".
		const envNamesPattern = RegExp(
			`^(.*${separator})?(${exactMatch})(${separator}.*)?$`,
			"i"
		);
		return envNamesPattern.test(deburr(environment));
	};

	const environmentMapping = {
		development: ["development", "dev", "trunk"],
		testing: ["testing", "test", "tests", "tst", "integration", "integ", "intg", "int", "acceptance", "accept", "acpt", "qa", "qc", "control", "quality", "uat", "sit"],
		staging: ["staging", "stage", "stg", "preprod", "model", "internal"],
		production: ["production", "prod", "prd", "live"]
	};

	const jiraEnv = Object.keys(environmentMapping).find(key => isEnvironment(environmentMapping[key]));

	if (!jiraEnv) {
		return "unmapped";
	}

	return jiraEnv;
};

// Maps issue ids and commit summaries to an array of associations (one for issue ids, and one for commits).
// Returns undefined when there are no issue ids to map.
const mapJiraIssueIdsAndCommitsToAssociationArray = (
	issueIds: string[],
	repositoryId: string,
	commitSummaries?: CommitSummary[]
): JiraAssociation[] | undefined => {

	if (!(issueIds && issueIds.length)) {
		return undefined;
	}

	const associations: JiraAssociation[] = [
		{
			associationType: "issueIdOrKeys",
			values: issueIds
		}
	];

	if (commitSummaries && commitSummaries.length) {
		const maximumCommitsToSubmit = MAX_ASSOCIATIONS_PER_ENTITY - issueIds.length;
		const commitKeys = commitSummaries
			.slice(0, maximumCommitsToSubmit)
			.map((commitSummary) => {
				return {
					commitHash: commitSummary.sha,
					repositoryId: repositoryId
				};
			});
		if (commitKeys.length > 0) {
			associations.push(
				{
					associationType: "commit",
					values: commitKeys
				}
			);
		}
	}

	return associations;
};

export const transformDeployment = async (githubInstallationClient: GitHubInstallationClient, payload: WebhookPayloadDeploymentStatus, jiraHost: string, logger: Logger): Promise<JiraDeploymentData | undefined> => {
	const deployment = payload.deployment;
	const deployment_status = payload.deployment_status;
	const { data: { commit: { message } } } = await githubInstallationClient.getCommit(payload.repository.owner.login, payload.repository.name, deployment.sha);

	let issueKeys;
	let associations: JiraAssociation[] | undefined;
	if (await booleanFlag(BooleanFlags.SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS, false, jiraHost)) {
		const commitSummaries = await getCommitsSinceLastSuccessfulDeployment(
			payload.repository.owner.login,
			payload.repository.name,
			deployment.sha,
			deployment.id,
			deployment_status.environment,
			githubInstallationClient,
			logger
		);

		const allCommitsMessages = extractMessagesFromCommitSummaries(commitSummaries);

		const shouldSendCommitsWithDeploymentEntities = await booleanFlag(BooleanFlags.SEND_RELATED_COMMITS_WITH_DEPLOYMENT_ENTITIES, false, jiraHost);
		if (shouldSendCommitsWithDeploymentEntities) {
			associations = mapJiraIssueIdsAndCommitsToAssociationArray(
				jiraIssueKeyParser(`${deployment.ref}\n${message}\n${allCommitsMessages}`),
				payload.repository.id.toString(),
				commitSummaries
			);
		} else {
			issueKeys = jiraIssueKeyParser(`${deployment.ref}\n${message}\n${allCommitsMessages}`);
		}
	} else {
		issueKeys = jiraIssueKeyParser(`${deployment.ref}\n${message}`);
	}

	if (isEmpty(issueKeys) && isEmpty(associations)) {
		return undefined;
	}

	const environment = mapEnvironment(deployment_status.environment);
	if (environment === "unmapped") {
		logger?.info({
			environment: deployment_status.environment,
			description: deployment.description
		}, "Unmapped environment detected.");
	}

	return {
		deployments: [{
			schemaVersion: "1.0",
			deploymentSequenceNumber: deployment.id,
			updateSequenceNumber: deployment_status.id,
			issueKeys,
			displayName: deployment.task,
			url: deployment_status.target_url || deployment.url,
			description: deployment.description || deployment_status.description || deployment.task,
			lastUpdated: new Date(deployment_status.updated_at),
			state: mapState(deployment_status.state),
			pipeline: {
				id: deployment.task,
				displayName: deployment.task,
				url: deployment_status.target_url || deployment.url
			},
			environment: {
				id: deployment_status.environment,
				displayName: deployment_status.environment,
				type: environment
			},
			associations
		}]
	};
};
