import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";

const REQUEST_ID = "customized-uuid-customized-uuid";

describe("rest deferred installation redirect route check", () => {
	const testSharedSecret = "test-secret";
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
	});

	describe("cloud", () => {
		it("throws 500 when random requestId is passed", async () => {
			const resp = await supertest(app)
				.get(`/rest/deferred-installation/request/random-uuid`);

			expect(resp.status).toEqual(500);
		});

		it("should return valid redirect URL when valid request is passed", async () => {
			const resp = await supertest(app)
				.get(`/rest/deferred-installation/request/${REQUEST_ID}`);

			expect(resp.status).toEqual(302);
		});
	});
});
