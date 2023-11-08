import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Installation } from "models/installation";

const VALID_REQUEST_ID = "customized-uuid-customized-uuid";
const validData = {
	gitHubInstallationId: 15,
	jiraHost: "https://customJirahost.com",
	installationIdPk: 0,
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

describe("rest deferred installation redirect route check", () => {
	let app, installation;
	const testSharedSecret = "test-secret";
	beforeEach(async () => {
		app = getFrontendApp();
		installation = await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
		validData.installationIdPk = installation.id;
	});

	describe("cloud", () => {
		it("should throw 401 error when no github token is passed", async () => {
			const resp = await supertest(app)
				.post(`/rest/app/cloud/deferred/connect/${VALID_REQUEST_ID}`);

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
						"login": "test-org-1",
						"id": 11,
						"type": "User",
						"site_admin": false
					},
					"app_id": 111
				});
			githubNock
				.get("/user/memberships/orgs/test-org-1")
				.reply(200, {
					role: "user"
				});

			const resp = await supertest(app)
				.post(`/rest/app/cloud/deferred/connect/${VALID_REQUEST_ID}`)
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
						"login": "test-org-1",
						"id": 11,
						"type": "User",
						"site_admin": false
					},
					"app_id": 111
				});
			githubNock
				.get("/user/memberships/orgs/test-org-1")
				.reply(200, {
					role: "admin"
				});

			const resp = await supertest(app)
				.post(`/rest/app/cloud/deferred/connect/${VALID_REQUEST_ID}`)
				.set("github-auth", "github-token");

			expect(resp.status).toBe(200);
		});
	});
});
