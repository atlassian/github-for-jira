import { JiraVulnerabilitySeverityEnum, JiraVulnerabilityStatusEnum } from "interfaces/jira";

// From GitHub: Severity can be one of: low, medium or moderate, high, critical
// To Jira: Status can be one of: low, medium, high, critical, unknown.
export const transformGitHubSeverityToJiraSeverity = (state: string, onUnmapped: (state: string) => void): JiraVulnerabilitySeverityEnum => {
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
			onUnmapped(state);
			return JiraVulnerabilitySeverityEnum.UNKNOWN;
	}
};

// From GitHub: Status can be one of: open, fixed, dismissed, auto_dismissed
// To Jira: Status can be one of: : open, closed, ignored, unknown
export const transformGitHubStateToJiraStatus = (state: string, onUnmapped: (state: string) => void): JiraVulnerabilityStatusEnum => {
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
			onUnmapped(state);
			return JiraVulnerabilityStatusEnum.UNKNOWN;
	}
};
