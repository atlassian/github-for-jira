import supertest from "supertest";
import nock from "nock";
import { getFrontendApp } from "~/src/app";
import { envVars } from "config/env";

describe("rest oauth router", () => {
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
	});
	describe("rest oauth callback", () => {
		describe("cloud", () => {
			it("should exchange for github access token", async () => {
				const code = "abcd";
				const nockUrl = `/login/oauth/access_token?client_id=${envVars.GITHUB_CLIENT_ID}&client_secret=${envVars.GITHUB_CLIENT_SECRET}&code=${code}&state=`;
				nock("https://github.com")
					.get(nockUrl)
					.matchHeader("accept", "application/json")
					.matchHeader("content-type", "application/json")
					.reply(200, {
						access_token: "behold!",
						refresh_token: "my-refresh-token"
					});

				const resp = await supertest(app)
					.get(`/rest/app/cloud/github-callback?code=${code}`)
					.expect("content-type", "text/html; charset=utf-8");

				expect(resp.text).toEqual(expect.stringContaining("behold!"));
				expect(resp.text).toEqual(expect.stringContaining("my-refresh-token"));

			});
		});
	});
});
