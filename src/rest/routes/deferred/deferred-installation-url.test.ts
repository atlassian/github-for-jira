import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { encodeSymmetric } from "atlassian-jwt";
import { envVars } from "config/env";
import { GetDeferredInstallationUrl } from "rest-interfaces";

const CUSTOMIZED_UUID = "customized-uuid-customized-uuid";
jest.mock("uuid", () => ({ v4: () => CUSTOMIZED_UUID }));

describe("Checking the deferred installation url route", () => {
	const testSharedSecret = "test-secret";
	const getToken = ({
		secret = testSharedSecret,
		iss = "jira-client-key",
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh" } = {}): string => encodeSymmetric({
		qsh,
		iss,
		exp
	}, secret);
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
	});

	describe("rest oauth callback", () => {
		describe("cloud", () => {
			it("should throw error when no gitHubInstallationId is passed", async () => {
				const gitHubOrgName = "sampleOrgName";

				const resp = await supertest(app)
					.get(`/rest/app/cloud/deferred/installation-url?gitHubOrgName=${gitHubOrgName}`)
					.set("authorization", `${getToken()}`);

				expect(resp.status).toEqual(400);
			});

			it("should throw error when no gitHubOrgName is passed", async () => {
				const gitHubInstallationId = 1234567890;

				const resp = await supertest(app)
					.get(`/rest/app/cloud/deferred/installation-url?gitHubInstallationId=${gitHubInstallationId}`)
					.set("authorization", `${getToken()}`);

				expect(resp.status).toEqual(400);
			});

			it("should return the deferred installation url", async () => {
				const gitHubInstallationId = 1234567890;
				const gitHubOrgName = "sampleOrgName";

				const resp = await supertest(app)
					.get(`/rest/app/cloud/deferred/installation-url?gitHubInstallationId=${gitHubInstallationId}&gitHubOrgName=${gitHubOrgName}`)
					.set("authorization", `${getToken()}`);

				expect(resp.status).toEqual(200);
				expect(resp.body).toHaveProperty("deferredInstallUrl");
				expect((resp.body as GetDeferredInstallationUrl).deferredInstallUrl).toBe(`${envVars.APP_URL}/spa/deferred?requestId=${CUSTOMIZED_UUID}`);
			});
		});
	});
});
