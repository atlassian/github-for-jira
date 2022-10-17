import { Repository } from "models/subscription";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { transformDeployment } from "../transforms/transform-deployment";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";

const fetchDeployments = async (gitHubInstallationClient: GitHubInstallationClient, repository: Repository, cursor?: string | number, perPage?: number) => {
	const deploymentData = await gitHubInstallationClient.getDeploymentsPage(repository.owner.login, repository.name, perPage, cursor);
	const edges = deploymentData.repository.deployments.edges || [];
	const deployments = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		deployments
	};
};

const getTransformedDeployments = async (deployments, gitHubInstallationClient: GitHubInstallationClient, jiraHost: string, logger: Logger, gitHubAppId: number | undefined) => {

	const transformTasks = deployments.map((deployment) => {
		const deploymentStatus = {
			repository: deployment.repository,
			deployment: {
				sha: deployment.commitOid,
				id: deployment.databaseId,
				ref: deployment.ref?.id,
				description: deployment.description,
				task: deployment.task,
				url: deployment.latestStatus?.logUrl
			},
			deployment_status: {
				environment: deployment.environment,
				id: deployment.databaseId,
				target_url: deployment.latestStatus?.logUrl,
				updated_at: deployment.latestStatus?.updatedAt,
				state: deployment.latestStatus?.state
			}
		} as WebhookPayloadDeploymentStatus;
		return transformDeployment(gitHubInstallationClient, deploymentStatus, jiraHost, logger, gitHubAppId);
	});

	const transformedDeployments = await Promise.all(transformTasks);
	return transformedDeployments
		.filter(deployment => !!deployment)
		.map(deployment => deployment.deployments)
		.flat();
};


export const getDeploymentTask = async (logger: Logger, gitHubInstallationClient: GitHubInstallationClient, jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number, data?: BackfillMessagePayload) => {
	logger.debug("Syncing Deployments: started");
	const { edges, deployments } = await fetchDeployments(gitHubInstallationClient, repository, cursor, perPage);

	if (!deployments?.length) {
		return {
			edges,
			jiraPayload: undefined
		};
	}

	const transformedDeployments = await getTransformedDeployments(deployments, gitHubInstallationClient, jiraHost, logger, data?.gitHubAppConfig?.gitHubAppId);
	logger.debug("Syncing Deployments: finished");

	const jiraPayload = transformedDeployments.length > 0 ? { deployments: transformedDeployments } : undefined;

	return {
		edges,
		jiraPayload
	};
};
