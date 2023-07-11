import Logger from "bunyan";
import { envVars } from "config/env";
import { createAnonymousClientByGitHubAppId } from "utils/get-github-client-config";

type TokenType = {
	accessToken: string;
	refreshToken: string;
};

export const finishOAuthFlow = async (
	gheUUID: string | undefined,
	code: string,
	state: string,
	log: Logger
): Promise<TokenType | null> => {

	if (!code) {
		log.warn("No code provided!");
		return null;
	}

	if (gheUUID) {
		log.warn("GHE not supported yet in rest oauth");
		return null;
	}

	try {

		const githubClient = await createAnonymousClientByGitHubAppId(
			undefined,
			undefined,
			{ trigger: "getAccessToken" },
			log
		);

		const { accessToken, refreshToken } = await githubClient.exchangeGitHubToken({
			clientId: envVars.GITHUB_CLIENT_ID,
			clientSecret: envVars.GITHUB_CLIENT_SECRET,
			code,
			state
		});

		return {
			accessToken,
			refreshToken
		};

	} catch (error) {
		log.warn({ error }, "Failed to acquire Github token...");
		return null;
	}
};
