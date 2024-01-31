import {
	JiraVulnerabilityBulkSubmitData, JiraVulnerabilitySeverityEnum, JiraVulnerabilityStatusEnum
} from "interfaces/jira";
import { getGitHubClientConfigFromAppId } from "utils/get-github-client-config";
import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import Logger from "bunyan";
import { Repository } from "@octokit/webhooks-types";
import { SecretScanningAlertResponseItem } from "../github/client/github-client.types";
import { capitalize, truncate } from "lodash";

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
			// display name cannot exceed 255 characters
			displayName: truncate(alert.secret_type_display_name || `${alert.secret_type} secret exposed`, { length: 254 }),
			description: getSecretScanningVulnDescription(alert, logger),
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
		logger.info(`Received unmapped state from secret_scanning_alert webhook: ${state ?? "Missing State"}`);
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

export const getSecretScanningVulnDescription = (alert: SecretScanningAlertResponseItem, logger: Logger) => {
	try {
		const description = `**Vulnerability:** Fix ${alert.secret_type_display_name}\n\n**State:** ${capitalize(alert.state)}\n\n**Secret type:** ${alert.secret_type}\n\nVisit the vulnerability’s [secret scanning alert page](${alert.html_url}) in GitHub to learn more about the potential active secret and remediation steps.`;
		// description cannot exceed 5000 characters
		return truncate(description, { length: 4999 });
	} catch (err: unknown) {
		logger.warn({ err }, "Failed to construct vulnerability description");
		return alert.secret_type_display_name;
	}
};