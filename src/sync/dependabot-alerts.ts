import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { VulnerabilityAlertNode } from "../github/client/github-queries";
import { transformRepositoryId } from "../transforms/transform-repository-id";
import { getGitHubClientConfigFromAppId } from "../util/get-github-client-config";
import { JiraVulnerabilityBulkSubmitData } from "../interfaces/jira";
import { mapVulnIdentifiers, transformGitHubSeverityToJiraSeverity, transformGitHubStateToJiraStatus } from "../transforms/transform-dependabot-alert";

export const getDependabotAlertTask = async (
	parentLogger: Logger,
	gitHubClient: GitHubInstallationClient,
	_jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload) => {

	const logger = parentLogger.child({ backfillTask: "Dependabot Alerts" });
	const startTime = Date.now();

	logger.info({ startTime }, "Dependabot Alerts task started");

	const result = await gitHubClient.getDependabotAlertsPage(repository.owner.login, repository.name, perPage, cursor as string);

	const fromDate = messagePayload.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const edges = result.repository.vulnerabilityAlerts.edges || [];
	const vulnerabilityAlerts = edges?.map(({ node: item }) => item) || [];
	if (areAllEdgesEarlierThanFromDate(edges, fromDate)) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	if (!vulnerabilityAlerts?.length) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges,
			jiraPayload: undefined
		};
	}

	const jiraPayload = await transformDependabotAlerts(vulnerabilityAlerts, messagePayload.jiraHost, parentLogger, messagePayload.gitHubAppConfig?.gitHubAppId);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.vulnerabilities?.length }, "Dependabot Alerts task complete");
	return {
		edges,
		jiraPayload
	};

};

const areAllEdgesEarlierThanFromDate = (edges: VulnerabilityAlertNode[], fromDate: Date | undefined) => {
	if (!fromDate) return false;
	const edgeCountEarlierThanFromDate = edges.filter(edge => {
		const edgeCreatedAt = new Date(edge.node.createdAt);
		return edgeCreatedAt.getTime() < fromDate.getTime();
	}).length;
	return edgeCountEarlierThanFromDate === edges.length;
};

const transformDependabotAlerts = async (alerts: VulnerabilityAlertNode["node"][], jiraHost: string, logger: Logger, gitHubAppId: number | undefined): Promise<JiraVulnerabilityBulkSubmitData> => {

	const githubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);

	const vulnerabilities = alerts.map((alert) => {
		return {
			schemaVersion: "1.0",
			id: `d-${transformRepositoryId(alert.repository.id, githubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(alert.repository.id,  githubClientConfig.baseUrl),
			displayName: alert.securityAdvisory.summary,
			description: alert.securityAdvisory.description,
			url: `${alert.repository.url}/security/dependabot/${alert.number}`,
			type: "sca",
			introducedDate: alert.createdAt,
			lastUpdated: alert.fixedAt || alert.dismissedAt || alert.autoDismissedAt || alert.createdAt,
			severity: {
				level: transformGitHubSeverityToJiraSeverity(alert.securityVulnerability?.severity?.toLowerCase(), logger)
			},
			identifiers: mapVulnIdentifiers(alert.securityAdvisory.identifiers, alert.securityAdvisory.references),
			status: transformGitHubStateToJiraStatus(alert.state?.toLowerCase(), logger),
			additionalInfo: {
				content: alert.vulnerableManifestPath
			}
		};
	});
	return { vulnerabilities };

};
