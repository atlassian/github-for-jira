import { getRedirectUrl } from "./service";
import { envVars } from "config/env";

const CLOUD_CALLBACK_TEMPLATE = `https://github.com/login/oauth/authorize?client_id=${envVars.GITHUB_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(envVars.APP_URL + "/rest/app/cloud/github-callback")}`;

describe("getRedirectUrl", () => {
	describe("cloud", () => {
		it("should generate redirect url for cloud", async () => {
			expect(await getRedirectUrl(undefined)).toEqual({
				redirectUrl: CLOUD_CALLBACK_TEMPLATE
			});
		});
	});
});
