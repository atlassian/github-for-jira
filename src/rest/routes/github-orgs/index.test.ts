import supertest from "supertest";
import nock from "nock";
import { encodeSymmetric } from "atlassian-jwt";
import { getFrontendApp } from "~/src/app";
import { Installation } from "~/src/models/installation";

describe("Test cases for GitHub Org Route", () => {
	const testSharedSecret = "test-secret";
	const sampleInstallations = [
		{
			"id": 1,
			"account": {
				"login": "test-org-1",
				"id": 11,
				"type": "User",
				"site_admin": false
			},
			"app_id": 111
		},
		{
			"id": 2,
			"account": {
				"login": "test-org-2",
				"id": 21,
				"type": "User",
				"site_admin": false
			},
			"app_id": 211
		},
		{
			"id": 3,
			"account": {
				"login": "test-org-3",
				"id": 31,
				"type": "User",
				"site_admin": false
			},
			"app_id": 311
		}
	];
	const githubNock = nock("https://api.github.com");
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
	describe("Fetching GitHub orgs", () => {
		it("Should return list of orgs", async () => {
			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });

			githubNock
				.get("/user/installations?per_page=100")
				.reply(200, {
					installations: sampleInstallations
				});

			const resp = await supertest(app)
				.get("/rest/app/cloud/org")
				.set("authorization", `${getToken()}`)
				.set("github-auth", "github-token");

			expect(resp.status).toBe(200);
			const body = resp.body as { orgs: { id: number, name: string }[] };
			expect(body).toHaveProperty("orgs");
			expect(body.orgs).toHaveLength(3);
		});
	});

	describe("Connecting GitHub orgs", () => {
		it("Should successfully connect a GitHub org", async () => {
			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });
			githubNock
				.get("/app/installations/4")
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
				.post("/rest/app/cloud/org")
				.set("authorization", `${getToken()}`)
				.set("github-auth", "github-token")
				.send({ installationId: 4 });

			expect(resp.status).toBe(200);
		});
		it("Should throw error for non-admin users", async () => {
			githubNock
				.get("/user")
				.reply(200, { login: "test-user" });
			githubNock
				.get("/app/installations/4")
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
				.post("/rest/app/cloud/org")
				.set("authorization", `${getToken()}`)
				.set("github-auth", "github-token")
				.send({ installationId: 4 });

			expect(resp.status).toBe(401);
			const body = resp.body as { errorCode: string };
			expect(body).toHaveProperty("errorCode");
			expect(body.errorCode).toBe("INSUFFICIENT_PERMISSION");
		});
		it("Should throw error for no github installation id", async () => {
			const resp = await supertest(app)
				.post("/rest/app/cloud/org")
				.set("authorization", `${getToken()}`)
				.set("github-auth", "github-token");

			expect(resp.status).toBe(400);
			const body = resp.body as { errorCode: string };
			expect(body).toHaveProperty("errorCode");
			expect(body.errorCode).toBe("INVALID_OR_MISSING_ARG");
		});
	});
});
