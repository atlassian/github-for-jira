import { Repository } from "models/subscription";
import type { DeploymentStatusEvent } from "@octokit/webhooks-types";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getDeploymentsResponse, DeploymentQueryNode } from "../github/client/github-queries";
import Logger from "bunyan";
import { transformDeployment } from "../transforms/transform-deployment";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { cacheSuccessfulDeploymentInfo } from "services/deployment-cache-service";

type FetchDeploymentResponse = { edges: DeploymentQueryNode[], deployments: DeploymentQueryNode["node"][] };
const fetchDeployments = async (gitHubInstallationClient: GitHubInstallationClient, repository: Repository, cursor?: string | number, perPage?: number): Promise<FetchDeploymentResponse>  => {

	const deploymentData: getDeploymentsResponse = await gitHubInstallationClient.getDeploymentsPage(repository.owner.login, repository.name, perPage, cursor);

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
		} as DeploymentStatusEvent;

		const metrics = {
			trigger: "backfill",
			subTrigger: "deployment"
		};
		return transformDeployment(gitHubInstallationClient, deploymentStatus, jiraHost, "backfill", metrics, logger, gitHubAppId);
	});

	const transformedDeployments = await Promise.all(transformTasks);
	return transformedDeployments
		.filter(deployment => !!deployment)
		.map(deployment => deployment.deployments)
		.flat();
};

const saveDeploymentsForLaterUse = async (deployments: FetchDeploymentResponse["deployments"], gitHubBaseUrl: string, logger: Logger) => {

	const successDeployments: FetchDeploymentResponse["deployments"] = deployments.filter(d => d.latestStatus.state === "success");
	logger.info({ deploymentsCount: deployments.length, successDeploymentsCount: successDeployments.length }, "Try to save deployments for later use");

	try {
		await Promise.all(successDeployments.map(dep => {
			return cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl,
				repositoryId: dep.repository.id,
				commitSha: dep.commitOid,
				env: dep.latestStatus.environment,
				createdAt: new Date(dep.latestStatus.createdAt)
			}, logger);
		}));
	} catch (reject) {
	}
};

export const getDeploymentTask = async (
	logger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {
	logger.debug("Syncing Deployments: started");

	const { edges, deployments } = await fetchDeployments(gitHubInstallationClient, repository, cursor, perPage);

	if (await booleanFlag(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_BACKFILL)) {
		await saveDeploymentsForLaterUse(deployments, gitHubInstallationClient.baseUrl);
	}

	const fromDate = messagePayload.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	if (areAllEdgesEarlierThanFromDate(edges, fromDate)) {
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	if (!deployments?.length) {
		return {
			edges,
			jiraPayload: undefined
		};
	}

	// latestStatus might always be defined, however in getTransformedDeployments() it is optional... leaving with
	// question mark for now. TODO: review logs and remove it here and in getTransformedDeployments() too
	logger.info(`Last deployment's updated_at=${deployments[deployments.length - 1].latestStatus?.updatedAt}`);

	const transformedDeployments = await getTransformedDeployments(deployments, gitHubInstallationClient, jiraHost, logger, messagePayload.gitHubAppConfig?.gitHubAppId);
	logger.debug("Syncing Deployments: finished");

	const jiraPayload = transformedDeployments.length > 0 ? { deployments: transformedDeployments } : undefined;

	return {
		edges,
		jiraPayload
	};
};

const areAllEdgesEarlierThanFromDate  = (edges: DeploymentQueryNode[], fromDate: Date | undefined) => {
	if (!fromDate) return false;
	const edgeCountEarlierThanFromDate = edges.filter(edge => {
		const edgeCreatedAt = new Date(edge.node.createdAt);
		return edgeCreatedAt.getTime() < fromDate.getTime();
	}).length;
	return edgeCountEarlierThanFromDate === edges.length;
};
