export enum Errors {
	MISSING_JIRA_HOST = "Jira Host url is missing",
	MISSING_GITHUB_TOKEN = "GitHub Auth token is missing",
	MISSING_ISSUE_KEY = "Issue key is missing",
	MISSING_SUBSCRIPTION = "No Subscription found",
	MISSING_GITHUB_APP_CONFIG = "No gitHubAppConfig found",
	IP_ALLOWLIST_MISCONFIGURED = "IP Allowlist Misconfigured",
	MISSING_GITHUB_APP_NAME = "Github App name is missing",
	MISSING_REPOSITORY_ID = "Missing repository ID",
	REPOSITORY_NOT_FOUND = "Repository not found"
}

export class UIDisplayableError extends Error {
	httpStatus: number;
	constructor(httpStatus: number, msg: string) {
		super(msg);
		this.httpStatus = httpStatus;
	}
}
