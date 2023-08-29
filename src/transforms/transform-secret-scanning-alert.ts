import {
	JiraVulnerabilityBulkSubmitData, JiraVulnerabilitySeverityEnum, JiraVulnerabilityStatusEnum
} from "interfaces/jira";
import { getGitHubClientConfigFromAppId } from "utils/get-github-client-config";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import Logger from "bunyan";
import { Repository } from "@octokit/webhooks-types";
import { SecretScanningAlertResponseItem } from "../github/client/github-client.types";

export const transformSecretScanningAlert = async (
	alert: SecretScanningAlertResponseItem,
	repository: Repository, jiraHost: string,
	gitHubAppId: number | undefined,
	logger: Logger
): Promise<JiraVulnerabilityBulkSubmitData> => {

	const githubClientConfig = await getGitHubClientConfigFromAppId(gitHubAppId, jiraHost);
	return {
		vulnerabilities: [{
			schemaVersion: "1.0",
			id: `s-${transformRepositoryId(repository.id, githubClientConfig.baseUrl)}-${alert.number}`,
			updateSequenceNumber: Date.now(),
			containerId: transformRepositoryId(repository.id, githubClientConfig.baseUrl),
			displayName: alert.secret_type_display_name || `${alert.secret_type} secret exposed`,
			description: "Secret scanning alert",
			url: alert.html_url,
			type: "sast",
			introducedDate: alert.created_at,
			lastUpdated: alert.updated_at || alert.created_at,
			severity: {
				level: JiraVulnerabilitySeverityEnum.CRITICAL
			},
			identifiers: [{
				displayName: alert.secret_type,
				url: alert.html_url
			}],
			status: transformGitHubStateToJiraStatus(alert.state, logger)
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
		case "open":
			return JiraVulnerabilityStatusEnum.OPEN;
		case "resolved":
			return JiraVulnerabilityStatusEnum.CLOSED;
		default:
			logger.info(`Received unmapped state from secret_scanning_alert webhook: ${state}`);
			return JiraVulnerabilityStatusEnum.UNKNOWN;
	}
};