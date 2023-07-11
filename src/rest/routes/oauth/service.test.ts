import { getRedirectUrl } from "./service";
import { envVars } from "config/env";
import IORedis from "ioredis";
import { getRedisInfo } from "config/redis-info";

const redis = new IORedis(getRedisInfo("oauth-state-nonce"));

const CLOUD_CALLBACK_TEMPLATE = `https://github.com/login/oauth/authorize?client_id=${envVars.GITHUB_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(envVars.APP_URL + "/rest/app/cloud/github-callback")}`;

describe("getRedirectUrl", () => {
	describe("cloud", () => {
		it("should generate redirect url for cloud", async () => {
			const resp = await getRedirectUrl(jiraHost, undefined);
			expect(resp).toEqual({
				redirectUrl: CLOUD_CALLBACK_TEMPLATE,
				state: expect.stringMatching(".+")
			});
			const redisState = await redis.get(resp.state) || "";
			expect(JSON.parse(redisState)).toEqual({
				jiraHost
			});
		});
	});
});
