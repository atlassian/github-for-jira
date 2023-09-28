import {
	JiraVulnerabilityBulkSubmitData,
	JiraVulnerabilityIdentifier
} from "interfaces/jira";
import { getGitHubClientConfigFromAppId } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { GitHubVulnIdentifier, GitHubVulnReference } from "interfaces/github";
import { DependabotAlert, DependabotAlertEvent } from "@octokit/webhooks-types";
import {
	transformGitHubSeverityToJiraSeverity,
	transformGitHubStateToJiraStatus
} from "~/src/transforms/util/github-security-alerts";
import { capitalize, truncate } from "lodash";
import Logger from "bunyan";
import { DependabotAlertResponseItem } from "../github/client/github-client.types";

export const mapVulnIdentifiers = (identifiers: GitHubVulnIdentifier[], references: GitHubVulnReference[], alertUrl: string): JiraVulnerabilityIdentifier[] => {
	const mappedIdentifiers: JiraVulnerabilityIdentifier[] = [];

	identifiers.forEach((identifier) => {
		const foundUrl = references.find((reference) => reference.url.includes(identifier.value))?.url;

		const mappedIdentifier: JiraVulnerabilityIdentifier = {
			displayName: identifier.value,
			url: foundUrl ? foundUrl : alertUrl
		};

		mappedIdentifiers.push(mappedIdentifier);
	});

	return mappedIdentifiers;
};

export const transformDependabotAlert = async (context: WebhookContext<DependabotAlertEvent>, jiraHost: string): Promise<JiraVulnerabilityBulkSubmitData> => {
	const { alert, repository } = context.payload;

	const githubClientConfig = await getGitHubClientConfigFromAppId(context.gitHubAppConfig?.gitHubAppId, jiraHost);

	const handleUnmappedState = (state: string) => context.log.info(`Received unmapped state from dependabot_alert webhook: ${state}`);
	const handleUnmappedSeverity = (severity: string | null) => context.log.info(`Received unmapped severity from dependabot_alert webhook: ${severity ?? "Missing Serverity"}`);
	const identifiers = mapVulnIdentifiers(alert.security_advisory.identifiers, alert.security_advisory.references, alert.html_url);

	return {
		vulnerabilities: [{
			schemaVersion: "1.0",
			id: `d-${transformRepositoryId(repository.id, githubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, githubClientConfig.baseUrl),
			// display name cannot exceed 255 characters
			displayName: truncate(alert.security_advisory.summary || `Dependabot alert #${alert.number}`, { length: 254 }),
			description: getDependabotScanningVulnDescription(alert, identifiers, context.log),
			url: alert.html_url,
			type: "sca",
			introducedDate: alert.created_at,
			lastUpdated: alert.updated_at || alert.created_at,
			severity: {
				level: transformGitHubSeverityToJiraSeverity(alert.security_vulnerability.severity, handleUnmappedSeverity)
			},
			identifiers,
			status: transformGitHubStateToJiraStatus(alert.state, handleUnmappedState),
			additionalInfo: {
				content: truncate(alert.dependency.manifest_path, { length: 254 })
			}
		}]
	};
};

export const getDependabotScanningVulnDescription = (
	alert: DependabotAlert | DependabotAlertResponseItem,
	identifiers: JiraVulnerabilityIdentifier[],
	logger: Logger) => {
	try {
		const identifiersText = getIdentifiersText(identifiers);
		// description cannot exceed 5000 characters
		const description = `**Vulnerability:** ${alert.security_advisory.summary}\n\n**Impact:** ${alert.security_advisory.description}\n\n**Severity:** ${capitalize(alert.security_advisory?.severity)} - ${alert.security_advisory?.cvss?.score}\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**State:** ${capitalize(alert.state)}\n\n**Patched version:** ${alert.security_vulnerability?.first_patched_version?.identifier}\n\n**Identifiers:**\n\n${identifiersText}\n\nVisit the vulnerability’s [dependabot alert page](${alert.html_url}) in GitHub to learn more about and see remediation options.`;
		return truncate(description, { length: 4999 });

	} catch (err: unknown) {
		logger.warn({ err }, "Failed to construct vulnerability description");
		return alert.security_advisory?.summary;
	}
};

const getIdentifiersText = (identifiers: JiraVulnerabilityIdentifier[]): string => {
	if (identifiers) {
		const identifiersLink = identifiers.map(identifier => `- [${identifier.displayName}](${identifier.url})`);
		return identifiersLink.join("\n");
	}
	return "";
};
