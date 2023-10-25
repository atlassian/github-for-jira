import { Repository } from "models/subscription";
import type { DeploymentStatusEvent } from "@octokit/webhooks-types";
import type { JiraDeploymentBulkSubmitData } from "interfaces/jira";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { getDeploymentsResponse, DeploymentQueryNode } from "../github/client/github-queries";
import Logger from "bunyan";
import { transformDeployment } from "../transforms/transform-deployment";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { cacheSuccessfulDeploymentInfo } from "services/deployment-cache-service";

const EXTRA_PAGE_COUNT = 1;

type FetchDeploymentResponse = { edges: DeploymentQueryNode[], deployments: DeploymentQueryNode["node"][], extraDeployments: DeploymentQueryNode["node"][] };
const fetchDeployments = async (jiraHost: string, gitHubInstallationClient: GitHubInstallationClient, repository: Repository, logger: Logger, cursor?: string | number, perPage?: number): Promise<FetchDeploymentResponse>  => {

	const deploymentData: getDeploymentsResponse = await gitHubInstallationClient.getDeploymentsPage(jiraHost, repository.owner.login, repository.name, perPage, cursor);

	const edges = deploymentData.repository.deployments.edges || [];
	const deployments = edges?.map(({ node: item }) => item) || [];

	let extraDeploymentResponse: getDeploymentsResponse | undefined;
	const extraDeployments: DeploymentQueryNode["node"][] = [];
	if (edges.length > 0 && await booleanFlag(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_BACKFILL, jiraHost)) {

		let lastEdges = edges;

		for (let i = 0; i < EXTRA_PAGE_COUNT && lastEdges.length > 0; i++) {
			try {
				extraDeploymentResponse = await gitHubInstallationClient.getDeploymentsPage(jiraHost, repository.owner.login, repository.name, perPage, lastEdges[lastEdges.length - 1].cursor);
				const extraDeploymentsEdges = extraDeploymentResponse.repository.deployments.edges || [];
				const extraDeploymentsItems = extraDeploymentsEdges?.map(({ node: item }) => item);
				extraDeployments.push(...extraDeploymentsItems);
				lastEdges = extraDeploymentsEdges;
			} catch (e: unknown) {
				logger.warn({ err: e }, "Error finding extraDeploymentData");
				throw e;
			}
		}
	}

	return {
		edges,
		deployments,
		extraDeployments
	};
};

const getTransformedDeployments = async (useDynamoForBackfill: boolean, deployments: DeploymentQueryNode["node"][], gitHubInstallationClient: GitHubInstallationClient, jiraHost: string, logger: Logger, gitHubAppId: number | undefined) => {

	const transformTasks = deployments.map((deployment) => {

		const firstNonInactiveStatus = useDynamoForBackfill ? deployment.statuses?.nodes.find(n=>n.state !== "INACTIVE") : undefined;
		if (!firstNonInactiveStatus && useDynamoForBackfill) {
			logger.warn({ foundStatusStates: deployment.statuses?.nodes.map(n=>n.state) },  "Should always find a first non inactive status. Ignore and fallback to latestStatus for now");
		}

		const logUrl = firstNonInactiveStatus?.logUrl || deployment.latestStatus?.logUrl;

		const deploymentStatus = {
			repository: deployment.repository,
			deployment: {
				sha: deployment.commitOid,
				id: deployment.databaseId,
				ref: deployment.ref?.id,
				description: deployment.description,
				task: deployment.task,
				url: logUrl
			},
			deployment_status: {
				environment: deployment.environment,
				id: deployment.databaseId,
				target_url: logUrl,
				created_at: firstNonInactiveStatus?.createdAt || deployment.latestStatus?.createdAt,
				updated_at: firstNonInactiveStatus?.updatedAt || deployment.latestStatus?.updatedAt,
				state: firstNonInactiveStatus?.state?.toLowerCase() || deployment.latestStatus?.state
			}
		} as any as DeploymentStatusEvent;

		return transformDeployment(gitHubInstallationClient, deploymentStatus, jiraHost, "backfill", logger, gitHubAppId);
	});

	const transformedDeployments = await Promise.all(transformTasks);
	return (transformedDeployments
		.filter(deployment => !!deployment) as JiraDeploymentBulkSubmitData[])
		.map(deployment => deployment.deployments)
		.flat();
};

const saveDeploymentsForLaterUse = async (deployments: FetchDeploymentResponse["deployments"], gitHubBaseUrl: string, logger: Logger) => {
	try {

		const successDeployments = deployments.filter(d => (d.statuses?.nodes.some(n => n.state === "SUCCESS")));
		logger.info({ deploymentsCount: deployments.length, successDeploymentsCount: successDeployments.length }, "Try to save deployments for later use");

		const result = await Promise.allSettled(successDeployments.map(dep => {

			const successStatusDate = dep.statuses?.nodes.find(n=>n.state === "SUCCESS")?.updatedAt;

			if (!successStatusDate) {
				logger.warn("Should find a success status date, but found none");
				throw new Error("Cannot find updatedAt date in the statuses with SUCCESS on state");
			}

			return cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl,
				repositoryId: dep.repository.id,
				commitSha: dep.commitOid,
				env: dep.environment,
				createdAt: new Date(successStatusDate)
			}, logger);

		}));

		const successCount = result.filter(r => r.status === "fulfilled").length;
		const failedCount = result.filter(r => r.status === "rejected").length;
		const isAllSuccess = failedCount === 0;

		logger.info({ successCount, failedCount, isAllSuccess }, "All deployments saving operation settled.");

	} catch (error: unknown) {
		logger.error({ err: error }, "Error saving success deployments");
	}
};

export const getDeploymentTask = async (
	parentLogger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {

	const logger = parentLogger.child({ backfillTask: "Deployment" });
	const startTime = Date.now();

	logger.info({ startTime }, "Backfill task started");

	const { edges, deployments, extraDeployments } = await fetchDeployments(jiraHost, gitHubInstallationClient, repository, logger, cursor, perPage);

	const useDynamoForBackfill = await booleanFlag(BooleanFlags.USE_DYNAMODB_FOR_DEPLOYMENT_BACKFILL, jiraHost);
	if (useDynamoForBackfill) {
		await saveDeploymentsForLaterUse([...deployments, ...extraDeployments], gitHubInstallationClient.baseUrl, logger);
	}

	const fromDate = messagePayload.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	if (areAllEdgesEarlierThanFromDate(edges, fromDate)) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	if (!deployments?.length) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges,
			jiraPayload: undefined
		};
	}

	// latestStatus might always be defined, however in getTransformedDeployments() it is optional... leaving with
	// question mark for now. TODO: review logs and remove it here and in getTransformedDeployments() too
	logger.info(`Last deployment's updated_at=${deployments[deployments.length - 1].latestStatus?.updatedAt}`);

	const transformedDeployments = await getTransformedDeployments(useDynamoForBackfill, deployments, gitHubInstallationClient, jiraHost, logger, messagePayload.gitHubAppConfig?.gitHubAppId);

	const jiraPayload = transformedDeployments.length > 0 ? { deployments: transformedDeployments } : undefined;

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.deployments?.length }, "Backfill task complete");

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
