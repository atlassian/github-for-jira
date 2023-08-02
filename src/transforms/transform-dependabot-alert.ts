import {
	JiraVulnerabilityBulkSubmitData,
	JiraVulnerabilityIdentifier
} from "interfaces/jira";
import { getGitHubClientConfigFromAppId } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { GitHubVulnIdentifier, GitHubVulnReference } from "interfaces/github";
import { DependabotAlertEvent } from "@octokit/webhooks-types";
import {
	transformGitHubSeverityToJiraSeverity,
	transformGitHubStateToJiraStatus
} from "~/src/transforms/util/github-security-alerts";

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

	const handleUnmapped = (state) => context.log.info(`Received unmapped state from dependabot_alert webhook: ${state}`);

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
				level: transformGitHubSeverityToJiraSeverity(alert.security_vulnerability.severity, handleUnmapped)
			},
			identifiers: mapVulnIdentifiers(alert.security_advisory.identifiers, alert.security_advisory.references),
			status: transformGitHubStateToJiraStatus(alert.state, handleUnmapped),
			additionalInfo: {
				content: alert.dependency.manifest_path
			}
		}]
	};
};
