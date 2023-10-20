import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";
import { encodeSymmetric } from "atlassian-jwt";

const VALID_REQUEST_ID = "customized-uuid-customized-uuid";
const validData = {
	gitHubInstallationId: 1234,
	jiraHost: "https://customJirahost.com",
	installationIdPk: 12312,
	orgName: "custom-orgName"
};
jest.mock("services/subscription-deferred-install-service",
	() => ({
		extractSubscriptionDeferredInstallPayload: (id: string) => {
			// Mocking the redis values
			if (id === VALID_REQUEST_ID) {
				return Promise.resolve(validData);
			} else {
				throw new Error("Empty request ID");
			}
		}
	})
);

describe("Checking the deferred request parsing route", () => {
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

	describe("cloud", () => {
		it("throws 401 without JWT", async () => {
			const resp = await supertest(app)
				.get(`/rest/app/cloud/deferred/parse/`);

			expect(resp.status).toEqual(401);
		});

		it("should return valid redirect URL when valid request is passed", async () => {
			const resp = await supertest(app)
				.get(`/rest/app/cloud/deferred/parse/${VALID_REQUEST_ID}`)
				.set("authorization", `${getToken()}`);

			expect(resp.status).toEqual(200);
			expect(resp.body).toMatchObject(validData);
		});
	});
});
