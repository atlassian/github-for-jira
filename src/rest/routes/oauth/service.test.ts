import { getRedirectUrl, finishOAuthFlow } from "./service";
import { envVars } from "config/env";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";
import { getLogger } from "config/logger";
import { createAnonymousClientByGitHubAppId } from "utils/get-github-client-config";
import { GitHubAnonymousClient } from "~/src/github/client/github-anonymous-client";
import { InvalidArgumentError } from "config/errors";

jest.mock("utils/get-github-client-config");

const redis = new IORedis(getRedisInfo("oauth-state-nonce"));
const log = getLogger("oauth service test");

const expectRedirectUrl = (state: string) => `https://github.com/login/oauth/authorize?client_id=${envVars.GITHUB_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(envVars.APP_URL + "/rest/app/cloud/github-callback")}&state=${encodeURIComponent(state)}`;

describe("getRedirectUrl", () => {
	describe("cloud", () => {
		it("should generate redirect url for cloud", async () => {
			const resp = await getRedirectUrl(undefined);
			expect(resp).toEqual({
				redirectUrl: expectRedirectUrl(resp.state),
				state: resp.state
			});
			const redisState = await redis.get(resp.state) || "";
			expect(JSON.parse(redisState)).toBeTruthy();
		});
	});
});

describe("Exchange token", () => {
	describe("cloud", () => {
		it("should throw error state is empty", async () => {
			jest.mocked(createAnonymousClientByGitHubAppId).mockResolvedValue({
				exchangeGitHubToken: () => ({
					accessToken: "abcd",
					refreshToken: "wert"
				})
			} as any as GitHubAnonymousClient);
			await expect(async () => {
				await finishOAuthFlow(undefined, "random-code", "", log);
			}).rejects.toThrowError(InvalidArgumentError);
		});
		it("should return correct result regardless of the jira host", async () => {
			const redirectUrl = await getRedirectUrl(undefined);
			const state = redirectUrl.state;
			jest.mocked(createAnonymousClientByGitHubAppId).mockResolvedValue({
				exchangeGitHubToken: () => ({
					accessToken: "abcd",
					refreshToken: "wert"
				})
			} as any as GitHubAnonymousClient);
			const resp = await finishOAuthFlow(undefined, "random-code", state, log);
			expect(resp).toEqual({
				accessToken: "abcd",
				refreshToken: "wert"
			});
		});
		it("should remove state in redis after check", async () => {
			const redirectUrl = await getRedirectUrl(undefined);
			const state = redirectUrl.state;
			jest.mocked(createAnonymousClientByGitHubAppId).mockResolvedValue({
				exchangeGitHubToken: () => ({
					accessToken: "abcd",
					refreshToken: "wert"
				})
			} as any as GitHubAnonymousClient);
			const resp = await finishOAuthFlow(undefined, "random-code", state, log);
			expect(resp).toEqual({
				accessToken: "abcd",
				refreshToken: "wert"
			});
			const stateInRedis = await redis.get(state);
			expect(stateInRedis).toBeNull();
		});
	});
});
