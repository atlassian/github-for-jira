import { JiraVulnerabilityBulkSubmitData, JiraVulnerabilityStatusEnum } from "interfaces/jira";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

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
			identifiers: [ // todo mapping
				{
					displayName: "CWE-123",
					url: "https://cwe.mitre.org/data/definitions/123.html"
				}
			],
			status: transformGitHubStateToJiraStatus(alert.state, context),
			additionalInfo: { //todo mapping
				content: "More information on the vulnerability, as a string",
				url: "https://example.com/project/CWE-123/additionalInfo"
			},
			associations: [{
				associationType: "issueKeys",
				values: ["placeholder"]//// todo create relationship manually, tbd longer term
			}]
		}]
	};
};
