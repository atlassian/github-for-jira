import { GitHubAPI } from "probot";
import { Repository } from "models/subscription";
import { WebhookPayloadDeploymentStatus } from "@octokit/webhooks";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
// import { JiraDeploymentData } from "src/interfaces/jira";
import { transformDeployment } from "../transforms/transform-deployment";
import { DeploymentQueryNode } from "../github/client/github-queries";

type DeploymentData = {
	edges: DeploymentQueryNode[],
	jiraPayload: any//JiraDeploymentData | undefined
}

const fetchDeployments = async (gitHubInstallationClient: GitHubInstallationClient, repository: Repository, cursor?: string | number, perPage?: number) => {
	const deploymentData = await gitHubInstallationClient.getDeploymentsPage(repository.owner.login, repository.name, perPage, cursor);
	const edges = deploymentData.repository.deployments.edges
	const deployments = edges?.map(({ node: item }) => item) || [];

	return {
		edges,
		deployments
	};
};

export const getDeploymentTask = async (logger: LoggerWithTarget, _github: GitHubAPI, gitHubInstallationClient: GitHubInstallationClient, jiraHost: string, repository: Repository, cursor?: string | number, perPage?: number): Promise<DeploymentData> => {
	
	logger.info("Syncing Deployments: started");
	const { edges, deployments } = await fetchDeployments(gitHubInstallationClient, repository, cursor, perPage);

	const transformedDeployments = (await Promise.all(deployments.map(async (node) => {
		const deploymentStatus = {
			repository: node.repository,
			deployment: {
				sha: node.commitOid,
				id: node.databaseId,
				ref: node.ref.id,
				description: node.description,
				task: node.task,
				url: node.latestStatus.logUrl
			},
			deployment_status: {
				environment: node.environment,
				id: node.databaseId,
				target_url: node.latestStatus.logUrl,
				updated_at: node.latestStatus.updatedAt,
				state: node.latestStatus.state
			}
		} as unknown as WebhookPayloadDeploymentStatus;
		const data = await transformDeployment(_github, gitHubInstallationClient, deploymentStatus, jiraHost, logger);
		return data?.deployments;
	}))).flat().filter((deployment) => !!deployment); // todo - use reduce!!

	logger.info("Syncing Deployments: finished");

	return {
		edges,
		jiraPayload: {
			deployments: transformedDeployments
		}
	};
};