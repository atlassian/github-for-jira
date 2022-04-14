import { GitHubAPI } from "probot";
import { Repository } from "models/subscription";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { transformDeployment } from "../transforms/transform-deployment";

const fetchDeployments = async (gitHubInstallationClient: GitHubInstallationClient, repository: Repository, cursor?: string | number, perPage?: number) => {
	const deploymentData = await gitHubInstallationClient.getDeploymentsPage(repository.owner.login, repository.name, perPage, cursor);
	const edges = deploymentData.repository.deployments.edges;
	const deployments = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		deployments
	};
};

const getTransformedDeployments = async (deployments, _github: GitHubAPI, gitHubInstallationClient: GitHubInstallationClient, jiraHost: string, logger: LoggerWithTarget) => {
	const transformTasks = await deployments.reduce(async (acc, current) => {
		const deploymentStatus = {
			repository: current.repository,
			deployment: {
				sha: current.commitOid,
				id: current.databaseId,
				ref: current.ref.id,
				description: current.description,
				task: current.task,
				url: current.latestStatus.logUrl
			},
			deployment_status: {
				environment: current.environment,
				id: current.databaseId,
				target_url: current.latestStatus.logUrl,
				updated_at: current.latestStatus.updatedAt,
				state: current.latestStatus.state
			}
		} as WebhookPayloadDeploymentStatus;
		const data = await transformDeployment(_github, gitHubInstallationClient, deploymentStatus, jiraHost, logger);

		if (data?.deployments) {
			(await acc).push(data?.deployments);
		}
		return await acc;
	}, []);

	const transformedDeployments = await Promise.all(transformTasks);

	return transformedDeployments.flat();
}

export const getDeploymentTask = async (logger: LoggerWithTarget, _github: GitHubAPI, gitHubInstallationClient: GitHubInstallationClient, jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number) => {

	logger.info("Syncing Deployments: started");
	const { edges, deployments } = await fetchDeployments(gitHubInstallationClient, repository, cursor, perPage);

	if (!deployments?.length) {
		return {
			edges,
			jiraPayload: undefined
		};
	}
	const transformedDeployments = await getTransformedDeployments(deployments, _github, gitHubInstallationClient, jiraHost, logger);
	
	logger.info("Syncing Deployments: finished");

	const jiraPayload = transformedDeployments.length > 0 ? { deployments: transformedDeployments } : undefined;

	return {
		edges,
		jiraPayload
	};
};