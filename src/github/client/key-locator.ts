import { GitHubServerApp } from "~/src/models/github-server-app";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { envVars } from "~/src/config/env";
import isBase64 from "is-base64";

const PRIVATE_KEY_BEGIN = "-----BEGIN RSA PRIVATE KEY-----";
const PRIVATE_KEY_END = "-----END RSA PRIVATE KEY-----";
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
			let privateKey = envVars.PRIVATE_KEY;
			if (isBase64(privateKey)) {
				privateKey = Buffer.from(privateKey, "base64").toString();
			}

			if (privateKey.includes(PRIVATE_KEY_BEGIN) && privateKey.includes(PRIVATE_KEY_END)) {
				// newlines are escaped
				if (privateKey.indexOf("\\n") !== -1) {
					privateKey = privateKey.replace(/\\n/g, "\n");
				}
				// newlines are missing
				if (privateKey.indexOf("\n") === -1) {
					privateKey = addNewlines(privateKey);
				}
				return privateKey;
			}
			throw new Error("The contents of 'env.PRIVATE_KEY' could not be validated.");
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

const addNewlines = (privateKey: string): string => {
	const middleLength = privateKey.length - PRIVATE_KEY_BEGIN.length - PRIVATE_KEY_END.length - 2;
	const middle = privateKey.substring(PRIVATE_KEY_BEGIN.length + 1, PRIVATE_KEY_BEGIN.length + middleLength + 1);
	return `${PRIVATE_KEY_BEGIN}\n${middle.trim().replace(/\s+/g, "\n")}\n${PRIVATE_KEY_END}`;
};
