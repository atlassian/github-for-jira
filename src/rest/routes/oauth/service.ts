import crypto  from "crypto";
import Logger from "bunyan";
import IORedis from "ioredis";
import { envVars } from "config/env";
import { GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { GetRedirectUrlResponse, ExchangeTokenResponse  } from "rest-interfaces";
import { createAnonymousClientByGitHubAppId } from "utils/get-github-client-config";
import { getRedisInfo } from "config/redis-info";
import { InvalidArgumentError } from "config/errors";

const FIVE_MINUTE_IN_MS = 5 * 60 * 1000;
const redis = new IORedis(getRedisInfo("oauth-state-nonce"));

/*
 * security method: https://auth0.com/docs/secure/attack-protection/state-parameters
 */
const generateNonce = async (jiraHost: string): Promise<string> => {
	const nonce = crypto.randomBytes(16).toString("base64");
	await redis.set(nonce, JSON.stringify({
		jiraHost
	}), "px", FIVE_MINUTE_IN_MS);
	return nonce;
};

export const getRedirectUrl = async (jiraHost: string, gheUUID: string | undefined): Promise<GetRedirectUrlResponse> => {

	let callbackPath: string, hostname: string, clientId: string;

	if (gheUUID) {
		/**
		 * This is for the GitHub enterprise flow, which is not being used for now,
		 * TODO: Fetch the hostname and clientId for the GitHubServerApp using the UUID
		 */
		callbackPath = `/rest/app/${gheUUID}/github-callback`;
		hostname = "";
		clientId = "";
	} else {
		callbackPath = `/rest/app/cloud/github-callback`;
		hostname = GITHUB_CLOUD_BASEURL;
		clientId = envVars.GITHUB_CLIENT_ID;
	}

	const scopes = [ "user", "repo" ];
	const callbackURI = `${envVars.APP_URL}${callbackPath}`;
	const nonce = await generateNonce(jiraHost);

	return {
		redirectUrl: `${hostname}/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes.join(" "))}&redirect_uri=${encodeURIComponent(callbackURI)}&state=${encodeURIComponent(nonce)}`,
		state: nonce
	};
};

export const finishOAuthFlow = async (
	jiraHost: string,
	gheUUID: string | undefined,
	code: string,
	state: string,
	log: Logger
): Promise<ExchangeTokenResponse> => {

	if (!code) {
		log.warn("No code provided!");
		throw new InvalidArgumentError("No code provided");
	}

	if (!state) {
		log.warn("State is empty");
		throw new InvalidArgumentError("No state provided");
	}

	if (gheUUID) {
		log.warn("GHE not supported yet in rest oauth");
		throw new InvalidArgumentError("GHE not supported yet in rest oauth");
	}

	const redisState = await redis.get(state) || "";

	try {
		await redis.unlink(state);
	} catch (e: unknown) {
		log.warn({ err: e }, "Failed to unlink redis state on oauth callback");
		//continue the flow as unlink is optional from user's point of view
	}

	if (!redisState) {
		log.warn({ state }, "state is missing in redis in oauth exchange token");
		throw new InvalidArgumentError("No redis state found for exchange github token");
	}

	const parsedState = JSON.parse(redisState) as { jiraHost?: string };

	if (jiraHost !== parsedState.jiraHost) {
		log.warn("Parsed redis state jiraHost doesn't match the jiraHost provided in jwt token");
		throw new InvalidArgumentError("Parsed redis state jiraHost doesn't match the jiraHost provided in jwt token");
	}

	const githubClient = await createAnonymousClientByGitHubAppId(
		undefined,
		undefined,
		{ trigger: "getAccessToken" },
		log
	);

	const gitHubTokens = await githubClient.exchangeGitHubToken({
		clientId: envVars.GITHUB_CLIENT_ID,
		clientSecret: envVars.GITHUB_CLIENT_SECRET,
		code,
		state
	});
	if (gitHubTokens === undefined) {
		log.warn("Failed to exchange token");
		throw new InvalidArgumentError("Failed to exchange token");
	}
	const { accessToken, refreshToken } = gitHubTokens;

	return {
		accessToken,
		refreshToken
	};

};
