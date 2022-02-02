import _ from "lodash";
import issueKeyParser from "jira-issue-key-parser";
import { JiraDeploymentData } from "../interfaces/jira";
import { GitHubAPI } from "probot";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { compareCommitsBetweenBaseAndHeadBranches } from "./util/githubApiRequests";
import RepoConfigDatabaseModel from '../config-as-code/repo-config-database-model';
import { RepoConfig } from '../config-as-code/repo-config';

// https://docs.github.com/en/rest/reference/repos#list-deployments
async function getLastSuccessfulDeployCommitSha(
	owner: string,
	repoName: string,
	github: GitHubAPI,
	deployments: Octokit.ReposListDeploymentsResponseItem[],
	logger?: LoggerWithTarget
): Promise<string> {

	try {
		for (const deployment of deployments) {
			// Get each deployment status for this environment so we can have their statuses' ids
			const listDeploymentStatusResponse: Octokit.Response<Octokit.ReposListDeploymentStatusesResponse> = await github.repos.listDeploymentStatuses({
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
	logger: LoggerWithTarget
): Promise<string | void | undefined> {

	// Grab the last 10 deployments for this repo
	const deployments: Octokit.Response<Octokit.ReposListDeploymentsResponse> = await github.repos.listDeployments({
		owner: owner,
		repo: repoName,
		environment: currentDeployEnv,
		per_page: 10 // Default is 30, max we can request is 100
	})

	// Filter per current environment and exclude itself
	const filteredDeployments = deployments.data
		.filter(deployment => deployment.id !== currentDeployId);

	// If this is the very first successful deployment ever, return nothing because we won't have any commit sha to compare with the current one.
	if (!filteredDeployments.length) {
		return undefined;
	}

	const lastSuccessfullyDeployedCommit = await getLastSuccessfulDeployCommitSha(owner, repoName, github, filteredDeployments, logger);

	const compareCommitsPayload = {
		owner: owner,
		repo: repoName,
		base: lastSuccessfullyDeployedCommit,
		head: currentDeploySha
	}

	const allCommitMessages = await compareCommitsBetweenBaseAndHeadBranches(
		compareCommitsPayload,
		github,
		logger
	);

	return allCommitMessages;
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
const isEnvironment = (envNames: string[], environment: string): boolean => {
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
	return envNamesPattern.test(_.deburr(environment));
};

export async function mapEnvironment(environment: string, deploymentsConfig?: RepoConfig | null): Promise<string> {
	const deploymentEnvironmentMapping = {
		development: ["development", "dev", "trunk"],
		testing: ["testing", "test", "tests", "tst", "integration", "integ", "intg", "int", "acceptance", "accept", "acpt", "qa", "qc", "control", "quality"],
		staging: ["staging", "stage", "stg", "preprod", "model", "internal"],
		production: ["production", "prod", "prd", "live"],
	};

	let environmentMapping;

	if (await booleanFlag(BooleanFlags.CONFIG_AS_CODE, false, jiraHost)) {
		const deploymentConfigEnvironmentMapping = deploymentsConfig?.deployments.environmentMapping;
		environmentMapping = deploymentsConfig ? deploymentConfigEnvironmentMapping : deploymentEnvironmentMapping
	} else {
		environmentMapping = deploymentEnvironmentMapping;
	}

	const jiraEnv =
		environmentMapping &&
		Object.keys(environmentMapping).find(key =>
			isEnvironment(environmentMapping[key.toLowerCase()], environment.toLowerCase())
		);

	if (!jiraEnv) {
		return "unmapped";
	}

	return jiraEnv;
}

export default async (
	githubClient: GitHubAPI,
	payload: WebhookPayloadDeploymentStatus,
	githubInstallationId: number,
	jiraHost: string,
	logger: LoggerWithTarget
): Promise<JiraDeploymentData | undefined> => {
	const { deployment, deployment_status, repository } = payload
	const { owner, id: repositoryId, name } = repository

	const {
		environment: deploymentStatusEnvironment,
		id: deploymentStatusId,
		target_url: deploymentStatusTargetUrl,
		description: deploymentStatusDescription,
		updated_at: deploymentStatusUpdatedAt,
		state: deploymentStatusState,
	} = deployment_status

	const {
		sha: deploymentSha,
		id: deploymentId,
		task: deploymentTask,
		url: deploymentUrl,
		description: deploymentDescription
	} = deployment

	const { data: { commit: { message } } } = await githubClient.repos.getCommit({
		owner: owner.login,
		repo: name,
		ref: deploymentSha
	});

	let issueKeys;

	if (await booleanFlag(BooleanFlags.SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS, false, jiraHost)) {
		const allCommitsMessages = await getCommitMessagesSinceLastSuccessfulDeployment(
			owner.login,
			name,
			deploymentSha,
			deploymentId,
			deploymentStatusEnvironment,
			githubClient,
			logger
		);

		issueKeys = issueKeyParser().parse(`${deployment.ref}\n${message}\n${allCommitsMessages}`) || [];
	} else {
		issueKeys = issueKeyParser().parse(`${deployment.ref}\n${message}`) || [];
	}

	if (_.isEmpty(issueKeys)) {
		return undefined;
	}

	let mappedDeploymentEnvironment;

	if (await booleanFlag(BooleanFlags.CONFIG_AS_CODE, false, jiraHost)) {
		const deploymentsConfig = await RepoConfigDatabaseModel.getForRepo(githubInstallationId, repositoryId);
		mappedDeploymentEnvironment = mapEnvironment(deploymentStatusEnvironment, deploymentsConfig);
	} else {
		mappedDeploymentEnvironment = mapEnvironment(deploymentStatusEnvironment);
	}

	if (mappedDeploymentEnvironment === "unmapped") {
		logger?.info({
			environment: deploymentStatusEnvironment,
			description: deploymentDescription
		}, "Unmapped environment detected.");
	}

	return {
		deployments: [{
			schemaVersion: "1.0",
			deploymentSequenceNumber: deploymentId,
			updateSequenceNumber: deploymentStatusId,
			issueKeys,
			displayName: deploymentTask,
			url: deploymentStatusTargetUrl || deploymentUrl,
			description: deploymentDescription || deploymentStatusDescription || deploymentTask,
			lastUpdated: new Date(deploymentStatusUpdatedAt),
			state: mapState(deploymentStatusState),
			pipeline: {
				id: deploymentTask,
				displayName: deploymentTask,
				url: deploymentStatusTargetUrl || deploymentUrl,
			},
			environment: {
				id: deploymentStatusEnvironment,
				displayName: deploymentStatusEnvironment,
				type: mappedDeploymentEnvironment,
			},
		}],
	};
};
