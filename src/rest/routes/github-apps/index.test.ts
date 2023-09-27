import supertest from "supertest";
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
	describe("Get github app new installation url", () => {
		describe("cloud", () => {
			it("should return github app new installation url", async () => {

				githubNock.get(`/app`).reply(200, { html_url: "https://github.com/apps/jira" });

				const resp = await supertest(app)
					.get("/rest/app/cloud/installation/new")
					.set("authorization", `${getToken()}`);

				expect(resp.body).toEqual({
					appInstallationUrl: "https://github.com/apps/jira/installations/new?state=spa"
				});

			});
		});
	});
});
