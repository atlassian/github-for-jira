import supertest from "supertest";
import nock from "nock";
import { encodeSymmetric } from "atlassian-jwt";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";

describe("Testing the route for fetching the Cloud Id", () => {
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
	it("Should successfully return the cloudId of the host", async () => {
		nock(jiraHost)
			.get("/_edge/tenant_info")
			.reply(200, { cloudId: "1234567890" });

		const resp = await supertest(app)
			.get("/rest/app/cloud/jira/cloudid")
			.set("authorization", `${getToken()}`);

		const body = resp.body as { cloudId: string };
		expect(resp.status).toBe(200);
		expect(body).toHaveProperty("cloudId");
		expect(body.cloudId).toBe("1234567890");
	});
});
