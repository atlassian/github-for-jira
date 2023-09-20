import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { transformRepositoryId } from "../transforms/transform-repository-id";
import { getGitHubClientConfigFromAppId } from "../util/get-github-client-config";
import { JiraVulnerabilityBulkSubmitData } from "../interfaces/jira";
import { PageSizeAwareCounterCursor } from "./page-counter-cursor";
import { CodeScanningAlertResponseItem, SortDirection } from "../github/client/github-client.types";
import {
	transformGitHubSeverityToJiraSeverity,
	transformRuleTagsToIdentifiers,
	transformGitHubStateToJiraStatus
} from "~/src/transforms/util/github-security-alerts";
import { getCodeScanningVulnDescription } from "../transforms/transform-code-scanning-alert";
import { truncate } from "lodash";

export const getCodeScanningAlertTask = async (
	parentLogger: Logger,
	gitHubClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload) => {

	const logger = parentLogger.child({ backfillTask: "Code scanning alerts" });
	const startTime = Date.now();

	logger.info({ startTime }, "Code scanning alerts task started");
	const fromDate = messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const smartCursor = new PageSizeAwareCounterCursor(cursor).scale(perPage);

	const { data: codeScanningAlerts  } = await gitHubClient.getCodeScanningAlerts(repository.owner.login, repository.name, {
		per_page: smartCursor.perPage,
		page: smartCursor.pageNo,
		sort: "created",
		direction: SortDirection.DES
	});

	if (!codeScanningAlerts?.length) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	if (areAllBuildsEarlierThanFromDate(codeScanningAlerts, fromDate)) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}
	logger.info(`Found ${codeScanningAlerts.length} code scanning alerts`);
	const nextPageCursorStr = smartCursor.copyWithPageNo(smartCursor.pageNo + 1).serialise();
	const edgesWithCursor = [{ codeScanningAlerts: codeScanningAlerts, cursor: nextPageCursorStr }];

	const jiraPayload = await transformCodeScanningAlert(codeScanningAlerts, repository, jiraHost, logger,  messagePayload.gitHubAppConfig?.gitHubAppId, gitHubClient);
	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.vulnerabilities?.length }, "Backfill task complete");
	return {
		edges: edgesWithCursor,
		jiraPayload
	};
};

const areAllBuildsEarlierThanFromDate = (alerts: CodeScanningAlertResponseItem[], fromDate: Date | undefined): boolean => {

	if (!fromDate) return false;

	return alerts.every(alert => {
		const createdAt = new Date(alert.created_at);
		return createdAt.getTime() < fromDate.getTime();
	});

};


const transformCodeScanningAlert = async (
	alerts: CodeScanningAlertResponseItem[],
	repository: Repository,
	jiraHost: string,
	logger: Logger,
	gitHubAppId: number | undefined,
	gitHubClient: GitHubInstallationClient
): Promise<JiraVulnerabilityBulkSubmitData> => {

	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);

	const handleUnmappedState = (state: string) => logger.info(`Received unmapped state from code_scanning_alert sync: ${state}`);
	const handleUnmappedSeverity = (severity: string | null) => logger.info(`Received unmapped severity from code_scanning_alert sync: ${severity ?? "Missing Severity"}`);

	const vulnerabilities = await Promise.all(alerts.map(async (alert) => {
		const { data: alertInstances } = await gitHubClient.getCodeScanningAlertInstances(repository.owner.login, repository.name, alert.number);
		const identifiers = transformRuleTagsToIdentifiers(alert.rule.tags);

		return {
			schemaVersion: "1.0",
			id: `c-${transformRepositoryId(repository.id, gitHubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, gitHubClientConfig.baseUrl),
			// display name cannot exceed 255 characters
			displayName: truncate(alert.rule.description || alert.rule.name, { length: 254 }),
			description: getCodeScanningVulnDescription(alert, identifiers, alertInstances, logger),
			url: alert.html_url,
			type: "sast",
			introducedDate: alert.created_at,
			lastUpdated: alert.dismissed_at || alert.fixed_at || alert.updated_at || alert.created_at,
			severity: {
				level: transformGitHubSeverityToJiraSeverity(alert.rule.security_severity_level, handleUnmappedSeverity)
			},
			...(identifiers ? { identifiers } : null),
			status: transformGitHubStateToJiraStatus(alert.state, handleUnmappedState),
			additionalInfo: {
				content: alert.tool.name
			}
		};
	}));
	return { vulnerabilities };

};
