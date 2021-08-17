import { Context } from "probot/lib/context";
import issueKeyParser from "jira-issue-key-parser";
import { JiraDeploymentData } from "../interfaces/jira";

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

function mapEnvironment(environment: string): string {
	// We need to map the environment of a GitHub deployment back to a valid deployment environment in Jira.
	// https://docs.github.com/en/actions/reference/environments
	// GitHub: does not have pre-defined values and users can name their environments whatever they like. We try to map as much as we can here and log the unmapped ones.
	// Jira: Can be one of unmapped, development, testing, staging, production
	const isEnvironment = (envNames) =>
		envNames.some(envName => environment.localeCompare(envName, undefined, { sensitivity: "base", ignorePunctuation: true }) === 0);

	const environmentMapping = {
		development: ["development", "dev", "trunk"],
		testing: ["testing", "test", "tests", "tst", "integration", "integ", "intg", "int", "acceptance", "accept", "acpt", "qa", "qc", "control", "quality"],
		staging: ["staging", "stage", "stg", "preprod", "model", "internal"],
		production: ["production", "prod", "live"],
	};

	const jiraEnv = Object.keys(environmentMapping).find(key => isEnvironment(environmentMapping[key]));

	if (!jiraEnv) {
		return "unmapped";
	}

	return jiraEnv;
}

export default async (context: Context): Promise<JiraDeploymentData> => {
	const { github, payload: { deployment_status, deployment } } = context;
	const { data: { commit: { message } } } = await github.repos.getCommit(context.repo({ ref: deployment.sha }));
	const issueKeys = issueKeyParser().parse(`${deployment.ref}\n${message}`);

	if (!issueKeys) {
		return undefined;
	}

	const environment = mapEnvironment(deployment_status.environment);
	if (environment === "unmapped") {
		context.log(`Unmapped environment detected for deployment. Unmapped value is ${deployment_status}. Sending it as unmapped to Jira.`);
	}

	return {
		deployments: [{
			schemaVersion: "1.0",
			deploymentSequenceNumber: deployment.id,
			updateSequenceNumber: deployment_status.id,
			issueKeys,
			displayName: deployment.task,
			url: deployment_status.log_url || deployment_status.target_url,
			description: deployment.description || deployment_status.description || deployment.task,
			lastUpdated: deployment_status.updated_at,
			state: mapState(deployment_status.state),
			pipeline: {
				id: deployment.task,
				displayName: deployment.task,
				url: deployment_status.log_url || deployment_status.target_url,
			},
			environment: {
				id: deployment_status.environment,
				displayName: deployment_status.environment,
				type: environment,
			},
		}],
	};
};
