import {
	JiraVulnerabilityBulkSubmitData,
	JiraVulnerabilityIdentifier,
	JiraVulnerabilityStatusEnum
} from "interfaces/jira";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { GitHubVulnIdentifier, GitHubVulnReference } from "interfaces/github";

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

const mapVulnIdentifiers = (identifiers: GitHubVulnIdentifier[], references: GitHubVulnReference[]): JiraVulnerabilityIdentifier[] => {
	const mappedIdentifiers:JiraVulnerabilityIdentifier[] = [];

	identifiers.forEach((identifier) => {
		const foundUrl = references.find((reference) => reference.url.includes(identifier.value))?.url;

		const mappedIdentifier:JiraVulnerabilityIdentifier = {
			displayName: identifier.value,
			url: foundUrl ? foundUrl : identifier.value
		};

		mappedIdentifiers.push(mappedIdentifier);
	});

	return mappedIdentifiers;
};

export const transformDependabotAlert = async (context: WebhookContext, githubInstallationId: number, jiraHost: string): Promise<JiraVulnerabilityBulkSubmitData | undefined> => {
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
				level: alert.security_vulnerability.severity
			},
			identifiers: mapVulnIdentifiers(alert.security_advisory.identifiers, alert.security_advisory.references),
			status: transformGitHubStateToJiraStatus(alert.state, context),
			additionalInfo: {
				content: "Manifest Path",
				url: alert.dependency.manifest_path
			},
			associations: [{
				associationType: "issueKeys",
				values: ["placeholder"]//// todo create relationship manually, tbd longer term
			}]
		}]
	};
};
