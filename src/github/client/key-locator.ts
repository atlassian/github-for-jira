import { GitHubServerApp } from "~/src/models/github-server-app";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { envVars } from "~/src/config/env";
import isBase64 from "is-base64";

/**
 * Look for a Github app's private key
 */
export const keyLocator = async (gitHubAppId: number | undefined): Promise<string> => {
	if (gitHubAppId) {
		const gitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(gitHubAppId);
		if (gitHubServerApp) {
			return await gitHubServerApp.getDecryptedPrivateKey();
		}
	}
	else {
		// Fetch private key for github cloud
		if (envVars.PRIVATE_KEY) {
			let privateKey = envVars.PRIVATE_KEY;
			if (isBase64(privateKey)) {
				privateKey = Buffer.from(privateKey, "base64").toString();
			}
			return privateKey;
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

