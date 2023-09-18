import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { transformRepositoryId } from "../transforms/transform-repository-id";
import { getGitHubClientConfigFromAppId } from "../util/get-github-client-config";
import { JiraVulnerabilityBulkSubmitData, JiraVulnerabilitySeverityEnum } from "../interfaces/jira";
import { PageSizeAwareCounterCursor } from "./page-counter-cursor";
import { SecretScanningAlertResponseItem, SortDirection } from "../github/client/github-client.types";
import { getSecretScanningVulnDescription, transformGitHubStateToJiraStatus } from "../transforms/transform-secret-scanning-alert";

export const getSecretScanningAlertTask = async (
	parentLogger: Logger,
	gitHubClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload) => {

	const logger = parentLogger.child({ backfillTask: "Secret scanning alerts" });
	const startTime = Date.now();

	logger.info({ startTime }, "Secret scanning alerts task started");
	const fromDate = messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const smartCursor = new PageSizeAwareCounterCursor(cursor).scale(perPage);

	const { data: secretScanningAlerts  } = await gitHubClient.getSecretScanningAlerts(repository.owner.login, repository.name, {
		per_page: smartCursor.perPage,
		page: smartCursor.pageNo,
		sort: "created",
		direction: SortDirection.DES
	});

	if (!secretScanningAlerts?.length) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	if (areAllBuildsEarlierThanFromDate(secretScanningAlerts, fromDate)) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}
	logger.info(`Found ${secretScanningAlerts.length} secret scanning alerts`);
	const nextPageCursorStr = smartCursor.copyWithPageNo(smartCursor.pageNo + 1).serialise();
	const edgesWithCursor = [{ secretScanningAlerts, cursor: nextPageCursorStr }];

	const jiraPayload = await transformSecretScanningAlert(secretScanningAlerts, repository, jiraHost, logger,  messagePayload.gitHubAppConfig?.gitHubAppId);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.vulnerabilities?.length }, "Backfill task complete");
	return {
		edges: edgesWithCursor,
		jiraPayload
	};
};

const areAllBuildsEarlierThanFromDate = (alerts: SecretScanningAlertResponseItem[], fromDate: Date | undefined): boolean => {

	if (!fromDate) return false;

	return alerts.every(alert => {
		const createdAt = new Date(alert.created_at);
		return createdAt.getTime() < fromDate.getTime();
	});

};


const transformSecretScanningAlert = async (
	alerts: SecretScanningAlertResponseItem[],
	repository: Repository,
	jiraHost: string,
	logger: Logger,
	gitHubAppId: number | undefined
): Promise<JiraVulnerabilityBulkSubmitData> => {

	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);

	const vulnerabilities = alerts.map((alert) => {
		return {
			schemaVersion: "1.0",
			id: `s-${transformRepositoryId(repository.id, gitHubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, gitHubClientConfig.baseUrl),
			displayName: alert.secret_type_display_name || `${alert.secret_type} secret exposed`,
			description: getSecretScanningVulnDescription(alert, logger),
			url: alert.html_url,
			type: "sast",
			introducedDate: alert.created_at,
			lastUpdated: alert?.resolved_at || alert.created_at,
			severity: {
				level: JiraVulnerabilitySeverityEnum.CRITICAL
			},
			identifiers: [{
				displayName: alert.secret_type,
				url: alert.html_url
			}],
			status: transformGitHubStateToJiraStatus(alert.state, logger)
		};
	});
	return { vulnerabilities };

};
