import Logger from "bunyan";
import { JiraAssociation, JiraDeploymentBulkSubmitData } from "interfaces/jira";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import {
	CommitSummary,
	extractMessagesFromCommitSummaries,
	getAllCommitsBetweenReferences
} from "./util/github-api-requests";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { AxiosResponse } from "axios";
import _, { deburr } from "lodash";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { Config } from "interfaces/common";
import { Subscription } from "models/subscription";
import minimatch from "minimatch";
import { getRepoConfig } from "services/user-config-service";
import { TransformedRepositoryId, transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { BooleanFlags, booleanFlag } from "config/feature-flags";
import { findLastSuccessDeployment } from "models/deployment-service";

const MAX_ASSOCIATIONS_PER_ENTITY = 500;

// https://docs.github.com/en/rest/reference/repos#list-deployments
const getLastSuccessfulDeployCommitSha = async (
	owner: string,
	repoName: string,
	githubInstallationClient: GitHubInstallationClient,
	deployments: Octokit.ReposListDeploymentsResponseItem[],
	logger?: Logger
): Promise<string> => {

	try {
		for (const deployment of deployments) {
			// Get each deployment status for this environment so we can have their statuses' ids
			const listDeploymentStatusResponse: AxiosResponse<Octokit.ReposListDeploymentStatusesResponse> =
				await githubInstallationClient.listDeploymentStatuses(owner, repoName, deployment.id, 100);
			// Find the first successful one
			const lastSuccessful = listDeploymentStatusResponse.data.find(deployment => deployment.state === "success");
			if (lastSuccessful) {

				return deployment.sha;
			}
		}
	} catch (e) {
		logger?.debug(`Failed to get deployment statuses.`);
	}

	// If there's no successful deployment on the list of deployments that GitHub returned us (max. 100) then we'll return the last one from the array, even if it's a failed one.
	return deployments[deployments.length - 1].sha;
};

const getCommitsSinceLastSuccessfulDeployment = async (
	owner: string,
	repoId: number,
	repoName: string,
	currentDeploySha: string,
	currentDeployId: number,
	currentDeployEnv: string,
	currentDeployDate: string,
	githubInstallationClient: GitHubInstallationClient,
	logger: Logger
): Promise<CommitSummary[] | undefined> => {

	if (await booleanFlag(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_WEBHOOK, jiraHost)) {
		logger.info("Using new dynamodb for get last success deployment");
		const lastSuccessful = await findLastSuccessDeployment({
			gitHubInstallationId: githubInstallationClient.githubInstallationId.installationId,
			env: currentDeployEnv,
			repositoryId: repoId,
			currentDate: new Date(currentDeployDate)
		}, logger);

		if (!lastSuccessful) {
			logger.info("Couldn't find last success deployment from dynamodb");
			return undefined;
		}
		logger.info("Found last success deployment info");

		const lastSuccessfullyDeployedCommit = lastSuccessful.commitSha;

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
	}

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
	if (!lastSuccessfullyDeployedCommit) {
		logger.info(`Skipped comparing commit base for deployment_status event as there's no past deployments`);
		return undefined;
	}

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

const matchesEnvironment = (environment: string, globPatterns: string[] = []): boolean => {
	for (const glob of globPatterns) {
		if (minimatch(environment, glob)) {
			return true;
		}
	}
	return false;
};

/**
 * Maps a given environment name to a Jira environment name using the custom mapping defined in a Config.
 */
export const mapEnvironmentWithConfig = (environment: string, config: Config): string | undefined => {
	return _.keys(config?.deployments?.environmentMapping)
		.find(jiraEnvironmentType => matchesEnvironment(environment, config.deployments?.environmentMapping?.[jiraEnvironmentType]));
};

// We need to map the environment of a GitHub deployment back to a valid deployment environment in Jira.
// https://docs.github.com/en/actions/reference/environments
// GitHub: does not have pre-defined values and users can name their environments whatever they like. We try to map as much as we can here and log the unmapped ones.
// Jira: Can be one of unmapped, development, testing, staging, production
export const mapEnvironment = (environment: string, config?: Config): string => {
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

	// if there is a user-defined config, we use that config for the mapping
	if (config) {
		const environmentType = mapEnvironmentWithConfig(environment, config);
		if (environmentType) {
			return environmentType;
		}
	}

	// if there is no user-defined config (or the user-defined config didn't match anything),
	// we fall back to hardcoded mapping

	const environmentMapping = {
		development: ["development", "dev", "trunk", "develop"],
		testing: ["testing", "test", "tests", "tst", "integration", "integ", "intg", "int", "acceptance", "accept", "acpt", "qa", "qc", "control", "quality", "uat", "sit"],
		staging: ["staging", "stage", "stg", "preprod", "model", "internal"],
		production: ["production", "prod", "prd", "live"]
	};

	return Object.keys(environmentMapping).find(key => isEnvironment(environmentMapping[key])) || "unmapped";
};


// Maps issue ids and commit summaries to an array of associations (one for issue ids, and one for commits).
// Returns undefined when there are no issue ids to map.
const mapJiraIssueIdsCommitsAndServicesToAssociationArray = (
	issueIds: string[],
	transformedRepositoryId: TransformedRepositoryId,
	commitSummaries?: CommitSummary[],
	config?: Config
): JiraAssociation[] | undefined => {

	const associations: JiraAssociation[] = [];
	let totalAssociationCount = 0;
	if (issueIds?.length) {
		const maximumIssuesToSubmit = MAX_ASSOCIATIONS_PER_ENTITY - totalAssociationCount;
		const issues = issueIds
			.slice(0, maximumIssuesToSubmit);
		associations.push(
			{
				associationType: "issueIdOrKeys",
				values: issues
			}
		);
		totalAssociationCount += issues.length;
	}

	if (config?.deployments?.services?.ids) {
		const maximumServicesToSubmit = MAX_ASSOCIATIONS_PER_ENTITY - totalAssociationCount;
		const services = config.deployments.services.ids
			.slice(0, maximumServicesToSubmit);
		associations.push(
			{
				associationType: "serviceIdOrKeys",
				values: services
			}
		);
		totalAssociationCount += config.deployments.services.ids.length;
	}

	if (commitSummaries?.length) {
		const maximumCommitsToSubmit = MAX_ASSOCIATIONS_PER_ENTITY - totalAssociationCount;
		const commitKeys = commitSummaries
			.slice(0, maximumCommitsToSubmit)
			.map((commitSummary) => {
				return {
					commitHash: commitSummary.sha,
					repositoryId: transformedRepositoryId
				};
			});
		if (commitKeys.length) {
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

export const transformDeployment = async (githubInstallationClient: GitHubInstallationClient, payload: WebhookPayloadDeploymentStatus, jiraHost: string, metrics: {trigger: string, subTrigger?: string}, logger: Logger, gitHubAppId: number | undefined): Promise<JiraDeploymentBulkSubmitData | undefined> => {
	const deployment = payload.deployment;
	const deployment_status = payload.deployment_status;
	const { data: { commit: { message } } } = await githubInstallationClient.getCommit(payload.repository.owner.login, payload.repository.name, deployment.sha);

	const commitSummaries = await getCommitsSinceLastSuccessfulDeployment(
		payload.repository.owner.login,
		payload.repository.id,
		payload.repository.name,
		deployment.sha,
		deployment.id,
		deployment_status.environment,
		deployment_status.created_at,
		githubInstallationClient,
		logger
	);


	let config: Config | undefined;

	const subscription = await Subscription.getSingleInstallation(jiraHost, githubInstallationClient.githubInstallationId.installationId, gitHubAppId);
	if (subscription) {
		config = await getRepoConfig(
			subscription,
			githubInstallationClient.githubInstallationId,
			payload.repository.id,
			payload.repository.owner.login,
			payload.repository.name,
			metrics
		);
	} else {
		logger.warn({
			jiraHost,
			githubInstallationId: githubInstallationClient.githubInstallationId.installationId
		}, "could not find subscription - not using user config to map environments!");
	}

	const allCommitsMessages = extractMessagesFromCommitSummaries(commitSummaries);
	const associations = mapJiraIssueIdsCommitsAndServicesToAssociationArray(
		jiraIssueKeyParser(`${deployment.ref}\n${message}\n${allCommitsMessages}`),
		transformRepositoryId(payload.repository.id, githubInstallationClient.baseUrl),
		commitSummaries,
		config
	);

	if (!associations?.length) {
		return undefined;
	}

	const environment = mapEnvironment(deployment_status.environment, config);

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
			displayName: (message || String(payload.deployment.id) || "").substring(0, 255),
			url: deployment_status.target_url || deployment.url,
			description: (deployment.description || deployment_status.description || deployment.task || "").substring(0, 255),
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
