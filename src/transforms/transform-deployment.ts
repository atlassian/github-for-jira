import { JiraDeploymentData } from "interfaces/jira";
import { GitHubAPI } from "probot";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { getAllCommitMessagesBetweenReferences } from "./util/github-api-requests";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { AxiosResponse } from "axios";
import { deburr, isEmpty } from "lodash";
import { jiraIssueKeyParser } from "utils/jira-utils";

// https://docs.github.com/en/rest/reference/repos#list-deployments
async function getLastSuccessfulDeployCommitSha(
	owner: string,
	repoName: string,
	github: GitHubAPI,
	newGitHubClient: GitHubInstallationClient,
	useNewClient: boolean,
	deployments: Octokit.ReposListDeploymentsResponseItem[],
	logger?: LoggerWithTarget
): Promise<string> {

	try {
		for (const deployment of deployments) {
			// Get each deployment status for this environment so we can have their statuses' ids
			const listDeploymentStatusResponse: Octokit.Response<Octokit.ReposListDeploymentStatusesResponse> | AxiosResponse<Octokit.ReposListDeploymentStatusesResponse> = useNewClient
				? await newGitHubClient.listDeploymentStatuses(owner, repoName, deployment.id, 100)
				: await github.repos.listDeploymentStatuses({
					owner: owner,
					repo: repoName,
					deployment_id: deployment.id,
					per_page: 100 // Default is 30, max we can request is 100
				});

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
}

async function getCommitMessagesSinceLastSuccessfulDeployment(
	owner: string,
	repoName: string,
	currentDeploySha: string,
	currentDeployId: number,
	currentDeployEnv: string,
	github: GitHubAPI,
	newGitHubClient: GitHubInstallationClient,
	useNewClient: boolean,
	logger: LoggerWithTarget
): Promise<string | void | undefined> {

	// Grab the last 10 deployments for this repo
	const deployments: Octokit.Response<Octokit.ReposListDeploymentsResponse> | AxiosResponse<Octokit.ReposListDeploymentsResponse> = useNewClient
		? await newGitHubClient.listDeployments(owner, repoName, currentDeployEnv, 10)
		: await github.repos.listDeployments({
			owner: owner,
			repo: repoName,
			environment: currentDeployEnv,
			per_page: 10 // Default is 30, max we can request is 100
		});

	// Filter per current environment and exclude itself
	const filteredDeployments = deployments.data
		.filter(deployment => deployment.id !== currentDeployId);

	// If this is the very first successful deployment ever, return nothing because we won't have any commit sha to compare with the current one.
	if (!filteredDeployments.length) {
		return undefined;
	}

	const lastSuccessfullyDeployedCommit = await getLastSuccessfulDeployCommitSha(owner, repoName, github, newGitHubClient, useNewClient, filteredDeployments, logger);

	const compareCommitsPayload = {
		owner: owner,
		repo: repoName,
		base: lastSuccessfullyDeployedCommit,
		head: currentDeploySha
	};

	return await getAllCommitMessagesBetweenReferences(
		compareCommitsPayload,
		useNewClient ? newGitHubClient : github,
		logger
	);
}

// We need to map the state of a GitHub deployment back to a valid deployment state in Jira.
// https://docs.github.com/en/rest/reference/repos#list-deployments
// Deployment state - GitHub: Can be one of error, failure, pending, in_progress, queued, or success
// https://developer.atlassian.com/cloud/jira/software/rest/api-group-builds/#api-deployments-0-1-bulk-post
// Deployment state - Jira: Can be one of unknown, pending, in_progress, cancelled, failed, rolled_back, successful
function mapState(state: string): string {
	switch (state) {
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
}

// We need to map the environment of a GitHub deployment back to a valid deployment environment in Jira.
// https://docs.github.com/en/actions/reference/environments
// GitHub: does not have pre-defined values and users can name their environments whatever they like. We try to map as much as we can here and log the unmapped ones.
// Jira: Can be one of unmapped, development, testing, staging, production
export function mapEnvironment(environment: string): string {
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
		testing: ["testing", "test", "tests", "tst", "integration", "integ", "intg", "int", "acceptance", "accept", "acpt", "qa", "qc", "control", "quality"],
		staging: ["staging", "stage", "stg", "preprod", "model", "internal"],
		production: ["production", "prod", "prd", "live"]
	};

	const jiraEnv = Object.keys(environmentMapping).find(key => isEnvironment(environmentMapping[key]));

	if (!jiraEnv) {
		return "unmapped";
	}

	return jiraEnv;
}

export const transformDeployment = async (githubClient: GitHubAPI, newGitHubClient: GitHubInstallationClient, payload: WebhookPayloadDeploymentStatus, jiraHost: string, logger: LoggerWithTarget): Promise<JiraDeploymentData | undefined> => {
	const deployment = payload.deployment;
	const deployment_status = payload.deployment_status;

	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DEPLOYMENTS, true, jiraHost);
	const { data: { commit: { message } } } = useNewGitHubClient ?
		await newGitHubClient.getCommit(payload.repository.owner.login, payload.repository.name, deployment.sha) :
		await githubClient.repos.getCommit({
			owner: payload.repository.owner.login,
			repo: payload.repository.name,
			ref: deployment.sha
		});


	let issueKeys;
	if (await booleanFlag(BooleanFlags.SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS, false, jiraHost)) {
		const allCommitsMessages = await getCommitMessagesSinceLastSuccessfulDeployment(
			payload.repository.owner.login,
			payload.repository.name,
			deployment.sha,
			deployment.id,
			deployment_status.environment,
			githubClient,
			newGitHubClient,
			useNewGitHubClient,
			logger
		);

		issueKeys = jiraIssueKeyParser(`${deployment.ref}\n${message}\n${allCommitsMessages}`);
	} else {
		issueKeys = jiraIssueKeyParser(`${deployment.ref}\n${message}`);
	}

	if (isEmpty(issueKeys)) {
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
			}
		}]
	};
};
