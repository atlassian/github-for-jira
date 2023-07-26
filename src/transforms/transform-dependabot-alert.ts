import {
	JiraVulnerabilityBulkSubmitData,
	JiraVulnerabilityIdentifier,
	JiraVulnerabilitySeverityEnum,
	JiraVulnerabilityStatusEnum
} from "interfaces/jira";
import { getGitHubClientConfigFromAppId } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { GitHubVulnIdentifier, GitHubVulnReference } from "interfaces/github";
import { DependabotAlertEvent } from "@octokit/webhooks-types";
import Logger from "bunyan";

// From GitHub: Status can be one of: open, fixed, dismissed, auto_dismissed
// To Jira: Status can be one of: : open, closed, ignored, unknown
export const transformGitHubStateToJiraStatus = (state: string, logger: Logger): JiraVulnerabilityStatusEnum => {
	switch (state) {
		case "open":
			return JiraVulnerabilityStatusEnum.OPEN;
		case "fixed":
			return JiraVulnerabilityStatusEnum.CLOSED;
		case "dismissed":
			return JiraVulnerabilityStatusEnum.IGNORED;
		case "auto_dismissed":
			return JiraVulnerabilityStatusEnum.IGNORED;
		default:
			logger.info(`Received unmapped state from dependabot_alert webhook: ${state}`);
			return JiraVulnerabilityStatusEnum.UNKNOWN;
	}
};
// From GitHub: Severity can be one of: low, medium or moderate, high, critical
// To Jira: Status can be one of: low, medium, high, critical, unknown.
export const transformGitHubSeverityToJiraSeverity = (state: string, logger: Logger): JiraVulnerabilitySeverityEnum => {
	switch (state) {
		case "low":
			return JiraVulnerabilitySeverityEnum.LOW;
		case "medium":
		case "moderate":
			return JiraVulnerabilitySeverityEnum.MEDIUM;
		case "high":
			return JiraVulnerabilitySeverityEnum.HIGH;
		case "critical":
			return JiraVulnerabilitySeverityEnum.CRITICAL;
		default:
			logger.info(`Received unmapped state from dependabot_alert webhook: ${state}`);
			return JiraVulnerabilitySeverityEnum.UNKNOWN;
	}
};

export const mapVulnIdentifiers = (identifiers: GitHubVulnIdentifier[], references: GitHubVulnReference[]): JiraVulnerabilityIdentifier[] => {
	const mappedIdentifiers: JiraVulnerabilityIdentifier[] = [];

	identifiers.forEach((identifier) => {
		const foundUrl = references.find((reference) => reference.url.includes(identifier.value))?.url;

		const mappedIdentifier: JiraVulnerabilityIdentifier = {
			displayName: identifier.value,
			url: foundUrl ? foundUrl : identifier.value
		};

		mappedIdentifiers.push(mappedIdentifier);
	});

	return mappedIdentifiers;
};

export const transformDependabotAlert = async (context: WebhookContext<DependabotAlertEvent>, jiraHost: string): Promise<JiraVulnerabilityBulkSubmitData> => {
	const { alert, repository } = context.payload;

	const githubClientConfig = await getGitHubClientConfigFromAppId(context.gitHubAppConfig?.gitHubAppId, jiraHost);
	return {
		vulnerabilities: [{
			schemaVersion: "1.0",
			id: `d-${transformRepositoryId(repository.id, githubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, githubClientConfig.baseUrl),
			displayName: alert.security_advisory.summary,
			description: alert.security_advisory.description,
			url: alert.html_url,
			type: "sca",
			introducedDate: alert.created_at,
			lastUpdated: alert.updated_at || alert.created_at,
			severity: {
				level: transformGitHubSeverityToJiraSeverity(alert.security_vulnerability.severity, context.log)
			},
			identifiers: mapVulnIdentifiers(alert.security_advisory.identifiers, alert.security_advisory.references),
			status: transformGitHubStateToJiraStatus(alert.state, context.log),
			additionalInfo: {
				content: alert.dependency.manifest_path
			}
		}]
	};
};
