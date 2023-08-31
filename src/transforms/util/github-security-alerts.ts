import { JiraVulnerabilitySeverityEnum, JiraVulnerabilityStatusEnum } from "interfaces/jira";

// From GitHub: Severity can be one of: low, medium or moderate, high, critical
// To Jira: Status can be one of: low, medium, high, critical, unknown.
export const transformGitHubSeverityToJiraSeverity = (severity: string | null, onUnmapped: (severity: string | null) => void): JiraVulnerabilitySeverityEnum => {
	switch (severity) {
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
			onUnmapped(severity);
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

export const transformRuleTagsToIdentifiers = (tags: string[] | null) => {
	if (!tags) {
		return null;
	}
	// CWE tags from GitHub take the format 'external/cwe/cwe-259'
	const cwePrefix = "external/cwe/cwe-";
	const identifiers = tags.filter(tag => tag.startsWith(cwePrefix)).map(tag => {
		// Remove starting 0s as GitHub can provide 'cwe-079'
		const cweId = tag.split(cwePrefix)[1].replace(/^0+/, "");
		return {
			displayName: `CWE-${cweId}`,
			url: `https://cwe.mitre.org/cgi-bin/jumpmenu.cgi?id=${cweId}`
		};
	});
	if (!identifiers.length) {
		return null;
	}
	return identifiers;
};
