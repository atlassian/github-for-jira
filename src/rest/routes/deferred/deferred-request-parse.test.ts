import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";

const REQUEST_ID_WITH_DIFFERENT_JIRAHOST = "invalid-request-id-with-dif-jirahost";
const dataForDifferentJiraHost = {
	gitHubInstallationId: 1234,
	jiraHost: "https://customJirahost.com",
	installationIdPk: 12312,
	orgName: "custom-orgName"
};
const VALID_REQUEST_ID = "valid-request-id";
const validData = {
	gitHubInstallationId: 1234,
	jiraHost: "https://test-atlassian-instance.atlassian.net",
	installationIdPk: 12312,
	orgName: "custom-orgName"
};
jest.mock("services/subscription-deferred-install-service",
	() => ({
		extractSubscriptionDeferredInstallPayload: (id: string) => {
			// Mocking the redis values
			if (id === REQUEST_ID_WITH_DIFFERENT_JIRAHOST) {
				return Promise.resolve(dataForDifferentJiraHost);
			} else if (id === VALID_REQUEST_ID) {
				return Promise.resolve(validData);
			} else {
				throw new Error("Empty request ID");
			}
		}
	})
);

describe("Checking the deferred request parsing route", () => {
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
		it("should return valid redirect URL when valid request is passed", async () => {
			const resp = await supertest(app)
				.get(`/rest/app/cloud/deferred/parse/${VALID_REQUEST_ID}`);
			expect(resp.status).toEqual(200);
			expect(resp.body).toMatchObject({
				"jiraHost": "https://t*********************e.atlassian.net",
				"orgName": "c************e"
			});
		});
	});
});
