import {
	JiraVulnerabilityBulkSubmitData,
	JiraVulnerabilityIdentifier,
	JiraVulnerabilitySeverityEnum,
	JiraVulnerabilityStatusEnum
} from "interfaces/jira";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { GitHubVulnIdentifier, GitHubVulnReference } from "interfaces/github";
import { DependabotAlertEvent } from "@octokit/webhooks-types";

// From GitHub: Status can be one of: open, fixed, dismissed, auto_dismissed
// To Jira: Status can be one of: : open, closed, ignored, unknown
const transformGitHubStateToJiraStatus = (state: string, context: WebhookContext): JiraVulnerabilityStatusEnum => {
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
			context.log.info(`Received unmapped state from dependabot_alert webhook: ${state}`);
			return JiraVulnerabilityStatusEnum.UNKNOWN;
	}
};
// From GitHub: Severity can be one of: low, medium, high, critical
// To Jira: Status can be one of: low, medium, high, critical, unknown.
const transformGitHubSeverityToJiraSeverity = (state: string, context: WebhookContext): JiraVulnerabilitySeverityEnum => {
	switch (state) {
		case "low":
			return JiraVulnerabilitySeverityEnum.LOW;
		case "medium":
			return JiraVulnerabilitySeverityEnum.MEDIUM;
		case "high":
			return JiraVulnerabilitySeverityEnum.HIGH;
		case "critical":
			return JiraVulnerabilitySeverityEnum.CRITICAL;
		default:
			context.log.info(`Received unmapped state from dependabot_alert webhook: ${state}`);
			return JiraVulnerabilitySeverityEnum.UNKNOWN;
	}
};

const mapVulnIdentifiers = (identifiers: GitHubVulnIdentifier[], references: GitHubVulnReference[]): JiraVulnerabilityIdentifier[] => {
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

export const transformDependabotAlert = async (context: WebhookContext<DependabotAlertEvent>, githubInstallationId: number, jiraHost: string): Promise<JiraVulnerabilityBulkSubmitData> => {
	const { alert, repository } = context.payload;

	const metrics = {
		trigger: "webhook",
		subTrigger: "dependabot_alert"
	};
	const gitHubInstallationClient = await createInstallationClient(githubInstallationId, jiraHost, metrics, context.log, context.gitHubAppConfig?.gitHubAppId);

	return {
		vulnerabilities: [{
			schemaVersion: "1.0",
			id: `d-${transformRepositoryId(repository.id, gitHubInstallationClient.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id),
			displayName: alert.security_advisory.summary,
			description: alert.security_advisory.description,
			url: alert.html_url,
			type: "sca",
			introducedDate: alert.created_at,
			lastUpdated: alert.updated_at || alert.created_at,
			severity: {
				level: transformGitHubSeverityToJiraSeverity(alert.security_vulnerability.severity, context)
			},
			identifiers: mapVulnIdentifiers(alert.security_advisory.identifiers, alert.security_advisory.references),
			status: transformGitHubStateToJiraStatus(alert.state, context),
			additionalInfo: {
				content: alert.dependency.manifest_path
			}
		}]
	};
};
