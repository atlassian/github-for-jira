import supertest from "supertest";
import nock from "nock";
import { envVars } from "config/env";
import { encodeSymmetric } from "atlassian-jwt";
import { getFrontendApp } from "~/src/app";
import { Installation } from "~/src/models/installation";

describe("rest oauth router", () => {
	const testSharedSecret = "test-secret";
	const getToken = ({
		secret = testSharedSecret,
		iss = "jira-client-key",
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh" } = {}): string => {
		return encodeSymmetric({
			qsh,
			iss,
			exp
		}, secret);
	};
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
	});
	describe("generating oauth redirect url", () => {
		describe("cloud", () => {
			it("should generate redirect url for cloud", async () => {
				const resp = await supertest(app)
					.get("/rest/app/cloud/oauth/redirectUrl")
					.set("authorization", `${getToken()}`);
				expect(resp.status).toBe(200);
				expect(resp.body).toEqual({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					redirectUrl: expect.stringContaining("github-callback"),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					state: expect.stringMatching(".+")
				});
			});
		});
	});
	describe("exchange token", () => {
		describe("cloud", () => {
			it("should exchange for github access token", async () => {

				const body = (await supertest(app).get("/rest/app/cloud/oauth/redirectUrl").set("authorization", `${getToken()}`)).body as { state: string};
				const state = body.state;
				expect(state).toEqual(expect.stringMatching(".+"));

				const code = "abcd";
				const nockUrl = `/login/oauth/access_token?client_id=${encodeURIComponent(envVars.GITHUB_CLIENT_ID)}&client_secret=${envVars.GITHUB_CLIENT_SECRET}&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
				nock("https://github.com")
					.get(nockUrl)
					.matchHeader("accept", "application/json")
					.matchHeader("content-type", "application/json")
					.reply(200, {
						access_token: "behold!",
						refresh_token: "my-refresh-token"
					});

				const resp = await supertest(app)
					.post("/rest/app/cloud/oauth/exchangeToken")
					.set("authorization", `${getToken()}`)
					.send({ code, state })
					.expect("content-type", "application/json; charset=utf-8");

				expect(resp.body).toEqual({
					accessToken: "behold!",
					refreshToken: "my-refresh-token"
				});

			});
		});
	});
});
