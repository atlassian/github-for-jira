import { GitHubServerApp } from "~/src/models/github-server-app";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { envVars } from "~/src/config/env";

/**
 * Look for a Github app's private key
 */
export const keyLocator = async (gitHubAppId?: number) => {
	if (gitHubAppId) {
		const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
		if (gitHubServerApp) {
			return await gitHubServerApp.decrypt("privateKey");
		}
	}
	else {
		// Fetch private key for github cloud
		if (envVars.PRIVATE_KEY) {
			return envVars.PRIVATE_KEY;
		}
		if (process.env.PRIVATE_KEY_PATH) {
			const filepath = resolve(process.cwd(), envVars.PRIVATE_KEY_PATH);
			if (existsSync(filepath)) {
				return readFileSync(filepath, "utf-8");
			} else {
				throw new Error(
					`Private key does not exists at path: "${envVars.PRIVATE_KEY_PATH}".`
				);
			}
		}
	}
	throw new Error(`Private key doesn not found for Github app ${gitHubAppId}`);
};
