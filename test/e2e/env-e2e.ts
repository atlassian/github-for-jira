import { envVars, EnvVars } from "config/env";
import { envCheck } from "utils/env-utils";

envCheck(
	"ATLASSIAN_URL",
	"JIRA_ADMIN_USERNAME",
	"JIRA_ADMIN_PASSWORD",
	"GITHUB_USERNAME",
	"GITHUB_PASSWORD",
	"GITHUB_URL"
);

export interface E2EEnvVars extends EnvVars {
	ATLASSIAN_URL: string;
	JIRA_ADMIN_USERNAME: string;
	JIRA_ADMIN_PASSWORD: string;
	GITHUB_USERNAME: string;
	GITHUB_PASSWORD: string;
	GITHUB_URL: string;
}

export const e2eEnvVars = envVars as E2EEnvVars;
