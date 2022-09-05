import { envVars, EnvVars } from "config/env";

const requiredEnvVars = [
	"ATLASSIAN_URL",
	"JIRA_ADMIN_USERNAME",
	"JIRA_ADMIN_PASSWORD",
	"GITHUB_USERNAME",
	"GITHUB_PASSWORD",
	"GITHUB_URL",
];

// Check to see if all required environment variables are set
const missingVars = requiredEnvVars.filter(key => envVars[key] === undefined);
if (missingVars.length) {
	throw new Error(`Missing required E2E Environment Variables: ${missingVars.join(", ")}`);
}

export interface E2EEnvVars extends EnvVars {
	ATLASSIAN_URL: string;
	JIRA_ADMIN_USERNAME: string;
	JIRA_ADMIN_PASSWORD: string;
	GITHUB_USERNAME: string;
	GITHUB_PASSWORD: string;
	GITHUB_URL: string;
}

export const e2eEnvVars = envVars as E2EEnvVars;
