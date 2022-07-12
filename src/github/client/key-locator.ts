import { GitHubServerApp } from "~/src/models/github-server-app";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

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
		if (process.env.PRIVATE_KEY_PATH) {
			const filepath = resolve(process.cwd(), process.env.PRIVATE_KEY_PATH);
			if (existsSync(filepath)) {
				return readFileSync(filepath, "utf-8");
			} else {
				throw new Error(
					`Private key does not exists at path: "${process.env.PRIVATE_KEY_PATH}".`
				);
			}
		}
		if (process.env.PRIVATE_KEY) {
			return process.env.PRIVATE_KEY;
		}
	}
	throw new Error(`Private key doesn not found for Github app ${gitHubAppId}`);
};
