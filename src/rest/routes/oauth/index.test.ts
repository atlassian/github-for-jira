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
		qsh = "context-qsh" } = {}): any => {
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
					redirectUrl: expect.stringContaining("github-callback")
				});
			});
		});
	});
});
