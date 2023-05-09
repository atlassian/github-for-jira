import { Installation } from "models/installation";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { encodeSymmetric } from "atlassian-jwt";
import { Express } from "express";
import { GitHubServerApp } from "models/github-server-app";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

describe("POST /jira/connect/enterprise", () => {
	let app: Express;
	let installation: Installation;
	let gitHubServerApp: GitHubServerApp;

	beforeEach(async () => {
		const result = await new DatabaseStateCreator().forServer().create();
		installation = result.installation;
		gitHubServerApp = result.gitHubServerApp!;

		app = getFrontendApp();
	});

	const generateJwt = async () => {
		return encodeSymmetric({
			qsh: "context-qsh",
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	const callEnterprisePostEndpoint = async (data) => await supertest(app)
		.post("/jira/connect/enterprise")
		.query({
			jwt: await generateJwt()
		})
		.send(data);

	afterEach(() => {
		delete process.env.JIRA_CONNECT_ENTERPRISE_POST_TIMEOUT_MSEC;
	});

	describe("unauthorized", () => {
		it("responds 401 without JWT token", async () => {
			const response = await supertest(app)
				.post("/jira/connect/enterprise")
				.set(
					"Cookie",
					"jiraHost=" + installation.jiraHost
				)
				.query({
					jiraHost: installation.jiraHost
				})
				.send({
					jiraHost: installation.jiraHost
				});
			expect(response.status).toStrictEqual(401);
		});
	});

	it("POST Jira Connect Enterprise - invalid URL", async () => {
		const response = await callEnterprisePostEndpoint({
			gheServerURL: "Random string!!"
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({ success: false, errors: [{ code: "GHE_ERROR_INVALID_URL" }] });
	});

	it("POST Jira Connect Enterprise - invalid URL (port)", async () => {
		const response = await callEnterprisePostEndpoint({
			gheServerURL: "http://foobar.com:12345"
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({
			success: false,
			errors: [{
				code: "GHE_ERROR_INVALID_URL",
				reason: "only the following ports are allowed: 80, 8080, 443, 6017, 8443, 8444, 7990, 8090, 8085, 8060, 8900, 9900"
			}]
		});
	});

	it("POST Jira Connect Enterprise - GitHub cloud", async () => {
		const response = await callEnterprisePostEndpoint({
			gheServerURL: "https://github.com:8090"
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({
			success: false,
			errors: [{
				code: "GHE_ERROR_GITHUB_CLOUD_HOST"
			}]
		});
	});

	it("POST Jira Connect Enterprise - valid existing URL", async () => {
		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({ success: true, connectConfigUuid: gitHubServerApp.uuid, appExists: true });
	});

	it("POST Jira Connect Enterprise - valid new URL to GHE", async () => {
		gheNock.get("/api/v3/rate_limit").reply(200, { }, { "X-GitHub-Request-id": "blah" });
		await gitHubServerApp.destroy();

		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({ success: true, connectConfigUuid: expect.any(String), appExists: false });

		expect(await new GheConnectConfigTempStorage().get(response.body.connectConfigUuid, installation.id))
			.toStrictEqual({
				serverUrl: gheUrl,
				apiKeyHeaderName: null,
				encryptedApiKeyValue: null
			});
	});

	it("POST Jira Connect Enterprise - valid new URL to not GHE", async () => {
		gheNock.get("/api/v3/rate_limit").reply(200, { });
		await gitHubServerApp.destroy();

		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({
			success: false, errors: [{
				code: "GHE_ERROR_CANNOT_CONNECT",
				reason: expect.stringMatching(/not GitHub Enterprise server/)
			}]
		});
	});

	it("POST Jira Connect Enterprise - URL timed out", async () => {
		await gitHubServerApp.destroy();
		process.env.JIRA_CONNECT_ENTERPRISE_POST_TIMEOUT_MSEC = "100";
		gheNock.get("/api/v3/rate_limit").delayConnection(2000).reply(200);

		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({
			success: false, errors: [{
				code: "GHE_ERROR_CANNOT_CONNECT",
				reason: "Timeout. ETIMEDOUT"
			}]
		});
	});

	it("POST Jira Connect Enterprise - DNS resolution failure", async () => {
		await gitHubServerApp.destroy();
		gheNock.get("/api/v3/rate_limit").replyWithError({ code: "ENOTFOUND" });

		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({
			success: false, errors: [{
				code: "GHE_ERROR_CANNOT_CONNECT",
				reason: "ENOTFOUND"
			}]
		});
	});

	it("POST Jira Connect Enterprise - invalid status code without GHE headers", async () => {
		await gitHubServerApp.destroy();

		gheNock.get("/api/v3/rate_limit").reply(500);
		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({
			success: false, "errors": [
				{
					"code": "GHE_ERROR_CANNOT_CONNECT",
					"reason": expect.stringMatching(/500/)
				}
			]
		});
	});

	it("POST Jira Connect Enterprise - invalid status code with GHE headers", async () => {
		await gitHubServerApp.destroy();

		gheNock.get("/api/v3/rate_limit").matchHeader("authorization", (value) => {
			return !!value && value.startsWith("Bearer");
		}).reply(401, { }, { "X-GitHub-Request-id": "blah" });

		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({ success: true, connectConfigUuid: expect.any(String), appExists: false });
	});

	it("POST Jira Connect Enterprise - invalid status code with GHE server headers", async () => {
		await gitHubServerApp.destroy();

		gheNock.get("/api/v3/rate_limit").reply(401, { }, { "server": "GitHub.com" });

		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({ success: true, connectConfigUuid: expect.any(String), appExists: false });
	});

	it("POST Jira Connect Enterprise - network error code will fail", async () => {
		await gitHubServerApp.destroy();

		const response = await callEnterprisePostEndpoint({
			gheServerURL: gitHubServerApp.gitHubBaseUrl
		});

		expect(response.status).toStrictEqual(200);
		expect(response.body).toStrictEqual({
			success: false, errors: [{
				code: "GHE_ERROR_CANNOT_CONNECT",
				reason: expect.stringMatching(/ENOTFOUND|EAI_AGAIN/)
			}]
		});
	});

	describe("API key fields", () => {
		beforeEach(async () => {
			await gitHubServerApp.destroy();
		});

		it("throws 400 when a header is a known one", async () => {
			const response = await callEnterprisePostEndpoint({
				gheServerURL: gitHubServerApp.gitHubBaseUrl,
				apiKeyHeader: "Set-Cookie",
				apiKeyValue: "jwt=bad-stuff"
			});

			expect(response.status).toStrictEqual(400);
		});

		it("throws 400 when a header name is longer than 1024", async () => {
			const response = await callEnterprisePostEndpoint({
				gheServerURL: gitHubServerApp.gitHubBaseUrl,
				apiKeyHeader: Array.from({ length: 1025 }, () => "x").join(""),
				apiKeyValue: "jwt=bad-stuff"
			});

			expect(response.status).toStrictEqual(400);
		});

		it("throws 400 when a header name is provided but the value is not", async () => {
			const response1 = await callEnterprisePostEndpoint({
				gheServerURL: gitHubServerApp.gitHubBaseUrl,
				apiKeyHeader: "OK-HEADER"
			});
			expect(response1.status).toStrictEqual(400);

			const response2 = await callEnterprisePostEndpoint({
				gheServerURL: gitHubServerApp.gitHubBaseUrl,
				apiKeyHeader: "OK-HEADER",
				apiKeyValue: "  "
			});
			expect(response2.status).toStrictEqual(400);
		});

		it("throws 400 when the value is longer than 8096 characters", async () => {
			const response = await callEnterprisePostEndpoint({
				gheServerURL: gitHubServerApp.gitHubBaseUrl,
				apiKeyHeader: "OK-HEADER",
				apiKeyValue: Array.from({ length: 9000 }, () => "x").join("")
			});

			expect(response.status).toStrictEqual(400);
		});

		it("uses API key in request to GHE", async () => {
			gheNock.get("/api/v3/rate_limit")
				.matchHeader("OK-HEADER", "foo")
				.reply(401, { }, { "server": "GitHub.com" });

			const response = await callEnterprisePostEndpoint({
				gheServerURL: gitHubServerApp.gitHubBaseUrl,
				apiKeyHeader: "OK-HEADER",
				apiKeyValue: "foo"
			});

			expect(response.status).toStrictEqual(200);
		});

		it("stores API key & value in storage in a secure way", async () => {
			gheNock.get("/api/v3/rate_limit")
				.matchHeader("OK-HEADER", "foo")
				.reply(401, { }, { "server": "GitHub.com" });

			const response = await callEnterprisePostEndpoint({
				gheServerURL: gitHubServerApp.gitHubBaseUrl,
				apiKeyHeader: "OK-HEADER ",
				apiKeyValue: "foo "
			});

			const storedConfig = await new GheConnectConfigTempStorage().get(response.body.connectConfigUuid, installation.id);
			expect(storedConfig).toStrictEqual({
				serverUrl: gheUrl,
				apiKeyHeaderName: "OK-HEADER",
				encryptedApiKeyValue: "encrypted:foo"
			});
		});
	});
});
