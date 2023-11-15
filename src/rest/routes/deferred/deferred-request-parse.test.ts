import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";

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
		it("should throw 401 error when no github token is passed", async () => {
			const resp = await supertest(app)
				.get(`/rest/app/cloud/deferred/parse/${VALID_REQUEST_ID}`);

			expect(resp.status).toEqual(401);
		});

		it("should return 403 error for non-owners", async () => {
			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });
			githubNock
				.get(`/app/installations/${validData.gitHubInstallationId}`)
				.reply(200, {
					"id": 4,
					"account": {
						"login": "custom-orgName",
						"id": 11,
						"type": "User",
						"site_admin": false
					},
					"app_id": 111
				});
			githubNock
				.get("/user/memberships/orgs/custom-orgName")
				.reply(200, {
					role: "user"
				});

			const resp = await supertest(app)
				.get(`/rest/app/cloud/deferred/parse/${VALID_REQUEST_ID}`)
				.set("github-auth", "github-token");

			expect(resp.status).toBe(403);
		});

		it("should return 200 for owners", async () => {
			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });
			githubNock
				.get(`/app/installations/${validData.gitHubInstallationId}`)
				.reply(200, {
					"id": 4,
					"account": {
						"login": "custom-orgName",
						"id": 11,
						"type": "User",
						"site_admin": false
					},
					"app_id": 111
				});
			githubNock
				.get("/user/memberships/orgs/custom-orgName")
				.reply(200, {
					role: "admin"
				});

			const resp = await supertest(app)
				.get(`/rest/app/cloud/deferred/parse/${VALID_REQUEST_ID}`)
				.set("github-auth", "github-token");

			expect(resp.status).toBe(200);
			expect(resp.body).toMatchObject({
				"jiraHost": "https://test-atlassian-instance.atlassian.net",
				"orgName": "custom-orgName"
			});
		});
	});
});
