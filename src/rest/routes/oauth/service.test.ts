import { getRedirectUrl, finishOAuthFlow } from "./service";
import { envVars } from "config/env";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";
import { getLogger } from "config/logger";
import { createAnonymousClientByGitHubAppId } from "utils/get-github-client-config";
import { GitHubAnonymousClient } from "~/src/github/client/github-anonymous-client";

jest.mock("utils/get-github-client-config");

const redis = new IORedis(getRedisInfo("oauth-state-nonce"));
const log = getLogger("oauth service test");

const expectRedirectUrl = (state) => `https://github.com/login/oauth/authorize?client_id=${envVars.GITHUB_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(envVars.APP_URL + "/rest/app/cloud/github-callback")}&state=${encodeURIComponent(state)}`;

describe("getRedirectUrl", () => {
	describe("cloud", () => {
		it("should generate redirect url for cloud", async () => {
			const resp = await getRedirectUrl(jiraHost, undefined);
			expect(resp).toEqual({
				redirectUrl: expectRedirectUrl(resp.state),
				state: resp.state
			});
			const redisState = await redis.get(resp.state) || "";
			expect(JSON.parse(redisState)).toEqual({
				jiraHost
			});
		});
	});
});

describe("Exchange token", () => {
	describe("cloud", () => {
		it("should return null if state is empty", async () => {
			jest.mocked(createAnonymousClientByGitHubAppId).mockResolvedValue({
				exchangeGitHubToken: async () => ({
					accessToken: "abcd",
					refreshToken: "wert"
				})
			} as any as GitHubAnonymousClient);
			const next = jest.fn();
			await finishOAuthFlow(jiraHost, undefined, "random-code", "", log, next);
			expect(next).toHaveBeenCalledWith({ status: 400, message: "No state provided" });
		});
		it("should return null if the jira host in state is not the same", async () => {
			const redirectUrl = await getRedirectUrl(jiraHost, undefined);
			const state = redirectUrl.state;
			jest.mocked(createAnonymousClientByGitHubAppId).mockResolvedValue({
				exchangeGitHubToken: async () => ({
					accessToken: "abcd",
					refreshToken: "wert"
				})
			} as any as GitHubAnonymousClient);
			const next = jest.fn();
			await finishOAuthFlow(jiraHost + "-another", undefined, "random-code", state, log, next);
			expect(next).toHaveBeenCalledWith({ status: 500, message: "Parsed redis state jiraHost doesn't match the jiraHost provided in jwt token" });
		});
		it("should return correct result if the jira host in state is the same", async () => {
			const redirectUrl = await getRedirectUrl(jiraHost, undefined);
			const state = redirectUrl.state;
			jest.mocked(createAnonymousClientByGitHubAppId).mockResolvedValue({
				exchangeGitHubToken: async () => ({
					accessToken: "abcd",
					refreshToken: "wert"
				})
			} as any as GitHubAnonymousClient);
			const resp = await finishOAuthFlow(jiraHost, undefined, "random-code", state, log, jest.fn);
			expect(resp).toEqual({
				accessToken: "abcd",
				refreshToken: "wert"
			});
		});
		it("should remove state in redis after check", async () => {
			const redirectUrl = await getRedirectUrl(jiraHost, undefined);
			const state = redirectUrl.state;
			jest.mocked(createAnonymousClientByGitHubAppId).mockResolvedValue({
				exchangeGitHubToken: async () => ({
					accessToken: "abcd",
					refreshToken: "wert"
				})
			} as any as GitHubAnonymousClient);
			const resp = await finishOAuthFlow(jiraHost, undefined, "random-code", state, log, jest.fn);
			expect(resp).toEqual({
				accessToken: "abcd",
				refreshToken: "wert"
			});
			const stateInRedis = await redis.get(state);
			expect(stateInRedis).toBeNull();
		});
	});
});
