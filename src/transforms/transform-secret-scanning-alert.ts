import {
	JiraVulnerabilityBulkSubmitData, JiraVulnerabilitySeverityEnum, JiraVulnerabilityStatusEnum
} from "interfaces/jira";
import { getGitHubClientConfigFromAppId } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { SecretScanningAlertEvent } from "../github/secret-scanning-alert";
import Logger from "bunyan";

export const transformSecretScanningAlert = async (context: WebhookContext<SecretScanningAlertEvent>, jiraHost: string): Promise<JiraVulnerabilityBulkSubmitData> => {
	const { alert, repository } = context.payload;

	const githubClientConfig = await getGitHubClientConfigFromAppId(context.gitHubAppConfig?.gitHubAppId, jiraHost);
	return {
		vulnerabilities: [{
			schemaVersion: "1.0",
			id: `d-${transformRepositoryId(repository.id, githubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, githubClientConfig.baseUrl),
			displayName: alert.secret_type_display_name || `${alert.secret_type} secret exposed`,
			description:  "Secret scanning alert",
			url: alert.html_url,
			type: "sca",
			introducedDate: alert.created_at,
			lastUpdated: alert.updated_at || alert.created_at,
			severity: {
				level: JiraVulnerabilitySeverityEnum.CRITICAL
			},
			identifiers: [],
			status: transformGitHubStateToJiraStatus(context.action, context.log),
			additionalInfo: {
				content: alert.secret_type
			}
		}]
	};
};


// From GitHub: Status can be one of: created, reopened, resolved, revoked
// To Jira: Status can be one of: : open, closed
export const transformGitHubStateToJiraStatus = (state: string | undefined, logger: Logger): JiraVulnerabilityStatusEnum => {
	if (!state) {
		logger.info(`Received unmapped state from secret_scanning_alert webhook: ${state}`);
		return JiraVulnerabilityStatusEnum.UNKNOWN;
	}
	switch (state) {
		case "created":
		case "reopened":
			return JiraVulnerabilityStatusEnum.OPEN;
		case "resolved":
		case "revoked":
			return JiraVulnerabilityStatusEnum.CLOSED;
		default:
			logger.info(`Received unmapped state from secret_scanning_alert webhook: ${state}`);
			return JiraVulnerabilityStatusEnum.UNKNOWN;
	}
};