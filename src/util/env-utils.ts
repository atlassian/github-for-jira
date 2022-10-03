import { envVars } from "config/env";

// Check to see if all required environment variables are set
export const envCheck = (...requiredEnvVars: string[]) => {
	const missingVars = requiredEnvVars.filter(key => envVars[key] === undefined);
	if (missingVars.length) {
		throw new Error(`Missing required Environment Variables: ${missingVars.join(", ")}`);
	}
};
