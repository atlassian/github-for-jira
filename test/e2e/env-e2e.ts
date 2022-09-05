import { envVars, EnvVars } from "config/env";
import { cloneDeep, difference } from "lodash";

const requiredEnvVars = [
	"ATLASSIAN_URL",
	"JIRA_ADMIN_USERNAME",
	"JIRA_ADMIN_PASSWORD",
	"GITHUB_USERNAME",
	"GITHUB_PASSWORD"
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
}

// Save original env vars so we can reset between tests
const originalEnvVars = cloneDeep(process.env);
export const resetEnvVars = () => {
	const originalKeys = Object.keys(originalEnvVars);
	const newKeys = Object.keys(process.env);
	// Reset original keys back to process.env
	originalKeys.forEach(key => process.env[key] = originalEnvVars[key]);
	// Removing keys that's been added during the test
	difference(newKeys, originalKeys).forEach(key => delete process.env[key]);
};
