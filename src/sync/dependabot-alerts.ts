import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import Logger from "bunyan";
import { BackfillMessagePayload } from "~/src/sqs/sqs.types";
import { transformRepositoryId } from "../transforms/transform-repository-id";
import { getGitHubClientConfigFromAppId } from "../util/get-github-client-config";
import { JiraVulnerabilityBulkSubmitData } from "../interfaces/jira";
import { getDependabotScanningVulnDescription, mapVulnIdentifiers } from "../transforms/transform-dependabot-alert";
import { PageSizeAwareCounterCursor } from "./page-counter-cursor";
import { DependabotAlertResponseItem, SortDirection } from "../github/client/github-client.types";
import {
	transformGitHubSeverityToJiraSeverity,
	transformGitHubStateToJiraStatus
} from "~/src/transforms/util/github-security-alerts";
import { truncate } from "lodash";

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
	const fromDate = messagePayload.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const smartCursor = new PageSizeAwareCounterCursor(cursor).scale(perPage);

	let dependabotAlerts: DependabotAlertResponseItem[];
	try {
		const response = await gitHubClient.getDependabotAlerts(repository.owner.login, repository.name, {
			per_page: smartCursor.perPage,
			page: smartCursor.pageNo,
			sort: "created",
			direction: SortDirection.DES
		});
		dependabotAlerts = response.data;
	} catch (e: unknown) {
		const err = e as { cause?: { response?: { status?: number, statusText?: string, data?: { message?: string } } } };
		if (err.cause?.response?.status == 403 && err.cause?.response?.data?.message?.includes("Dependabot alerts are disabled for this repository")) {
			logger.info({ err, githubInstallationId: gitHubClient.githubInstallationId }, "Dependabot alerts disabled, so marking backfill task complete");
			return {
				edges: [],
				jiraPayload: undefined
			};
		} else if (err.cause?.response?.status == 403 && err.cause?.response?.data?.message?.includes("Dependabot alerts are not available for archived repositories")) {
			logger.info({ err, githubInstallationId: gitHubClient.githubInstallationId }, "Archived repository, so marking backfill task complete");
			return {
				edges: [],
				jiraPayload: undefined
			};
		} else if (err.cause?.response?.status == 404) {
			logger.info({ err, githubInstallationId: gitHubClient.githubInstallationId }, "Repo not found, so marking backfill task complete");
			return {
				edges: [],
				jiraPayload: undefined
			};
		} else if (err.cause?.response?.status == 451) {
			logger.info({ err, githubInstallationId: gitHubClient.githubInstallationId }, "Repo not available due to legal reasons, so marking backfill task complete");
			return {
				edges: [],
				jiraPayload: undefined
			};
		}
		logger.error({ err, reason: err.cause?.response?.data }, "Dependabot alert backfill failed");
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw err;
	}

	if (!dependabotAlerts?.length) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	if (areAllBuildsEarlierThanFromDate(dependabotAlerts, fromDate)) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	logger.info(`Found ${dependabotAlerts.length} dependabot alerts`);
	const nextPageCursorStr = smartCursor.copyWithPageNo(smartCursor.pageNo + 1).serialise();
	const edgesWithCursor = [{ dependabotAlerts, cursor: nextPageCursorStr }];

	const jiraPayload = await transformDependabotAlerts(dependabotAlerts, repository, messagePayload.jiraHost, parentLogger, messagePayload.gitHubAppConfig?.gitHubAppId);

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload?.vulnerabilities?.length }, "Dependabot Alerts task complete");
	return {
		edges: edgesWithCursor,
		jiraPayload
	};

};

const areAllBuildsEarlierThanFromDate = (alerts: DependabotAlertResponseItem[], fromDate: Date | undefined): boolean => {

	if (!fromDate) return false;

	return alerts.every(alert => {
		const createdAt = new Date(alert.created_at);
		return createdAt.getTime() < fromDate.getTime();
	});

};
export const transformDependabotAlerts = async (
	alerts: DependabotAlertResponseItem[],
	repository: Repository,
	jiraHost: string,
	logger: Logger,
	gitHubAppId: number | undefined
): Promise<JiraVulnerabilityBulkSubmitData> => {

	const gitHubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);

	const handleUnmappedState = (state: string) => { logger.info(`Received unmapped state from dependabot_alerts sync: ${state}`); };
	const handleUnmappedSeverity = (severity: string | null) => { logger.info(`Received unmapped severity from dependabot_alerts sync: ${severity ?? "Missing Severity"}`); };

	const vulnerabilities = alerts.map((alert) => {
		const identifiers = mapVulnIdentifiers(alert.security_advisory.identifiers, alert.security_advisory.references, alert.html_url);
		return {
			schemaVersion: "1.0",
			id: `d-${transformRepositoryId(repository.id, gitHubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, gitHubClientConfig.baseUrl),
			// display name cannot exceed 255 characters
			displayName: truncate(alert.security_advisory.summary || `Dependabot alert #${alert.number}`, { length: 254 }),
			description: getDependabotScanningVulnDescription(alert, identifiers, logger),
			url: alert.html_url,
			type: "sca",
			introducedDate: alert.created_at,
			lastUpdated: alert.updated_at,
			severity: {
				level: transformGitHubSeverityToJiraSeverity(alert.security_vulnerability?.severity?.toLowerCase(), handleUnmappedSeverity)
			},
			identifiers,
			status: transformGitHubStateToJiraStatus(alert.state?.toLowerCase(), handleUnmappedState),
			additionalInfo: {
				content: truncate(alert.dependency.manifest_path, { length: 254 })
			}
		};
	});
	return { vulnerabilities };

};
