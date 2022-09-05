import { envVars, EnvVars } from "config/env";
import { cloneDeep, difference } from "lodash";

const requiredEnvVars = [
	"SQS_TEST_QUEUE_URL",
	"SQS_TEST_QUEUE_REGION"
];

// Check to see if all required environment variables are set
const missingVars = requiredEnvVars.filter(key => envVars[key] === undefined);
if (missingVars.length) {
	throw new Error(`Missing required Test Environment Variables: ${missingVars.join(", ")}`);
}

export interface TestEnvVars extends EnvVars {
	// Test Vars
	ATLASSIAN_SECRET?: string;
	AWS_ACCESS_KEY_ID?: string;
	AWS_SECRET_ACCESS_KEY?: string;
	SQS_TEST_QUEUE_URL: string;
	SQS_TEST_QUEUE_REGION: string;
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
