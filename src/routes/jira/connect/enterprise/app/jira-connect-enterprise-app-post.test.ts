import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { Express } from "express";
import { Installation } from "models/installation";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { v4 } from "uuid";
import fs from "fs";
import path from "path";
import { GitHubServerApp } from "models/github-server-app";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

describe("jira-connect-enterprise-app-post", () => {
	let app: Express;
	let installation: Installation;

	beforeEach(async () => {
		app = getFrontendApp();

		const result = await new DatabaseStateCreator().forCloud().create();
		installation = result.installation;
	});

	describe("unauthorized", () => {
		it("returns 401 when JWT is invalid", async () => {
			const response = await supertest(app)
				.post("/jira/connect/enterprise/app")
				.query({
					jwt: "bar"
				});
			expect(response.status).toStrictEqual(401);
		});

		it("returns 401 JWT is missing", async () => {
			const response = await supertest(app)
				.post("/jira/connect/enterprise/app")
				.query({
					jiraHost: installation.jiraHost
				})
				.set("Cookie", [`jiraHost=${installation.jiraHost}`]);
			expect(response.status).toStrictEqual(401);
		});
	});

	describe("authorized", () => {

		let TEST_GHE_APP_PARTIAL;

		beforeEach(() => {
			TEST_GHE_APP_PARTIAL = {
				appId: 12321,
				gitHubBaseUrl: gheUrl,
				gitHubClientId: "client-id" + Math.random().toString(),
				gitHubClientSecret: "client-secret",
				webhookSecret: "webhook-secret",
				privateKey: fs.readFileSync(path.resolve(__dirname, "../../../../../../test/setup/test-key.pem"), { encoding: "utf8" }),
				gitHubAppName: "app-name"
			};
		});

		const generateJwt = async () => {
			return encodeSymmetric({
				qsh: "context-qsh",
				iss: installation.plainClientKey
			}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
		};

		it("avoids collision with other customers", async () => {
			const anotherOne = await new DatabaseStateCreator().forServer().create();
			const response = await supertest(app)
				.post("/jira/connect/enterprise/app")
				.send({
					... anotherOne.gitHubServerApp!.dataValues
				})
				.query({
					jwt: await generateJwt()
				});
			expect(response.status).toStrictEqual(400);
		});

		it.each(["set-cookie: blah", "foo:", ":foo"])("validates API key fields %s", async (apiKeyNameValue) => {
			const uuid = v4();

			const response = await supertest(app)
				.post("/jira/connect/enterprise/app")
				.send({
					... TEST_GHE_APP_PARTIAL,
					uuid,
					apiKeyHeaderName: apiKeyNameValue.split(":")[0].trim(),
					apiKeyValue: apiKeyNameValue.split(":")[1].trim()
				})
				.query({
					jwt: await generateJwt()
				});

			expect(response.status).toStrictEqual(400);
		});

		it("successfully creates an item without API key", async () => {
			const uuid = v4();

			const response = await supertest(app)
				.post("/jira/connect/enterprise/app")
				.send({
					... TEST_GHE_APP_PARTIAL,
					uuid
				})
				.query({
					jwt: await generateJwt()
				});

			expect(response.status).toStrictEqual(202);
			expect((await GitHubServerApp.findForUuid(uuid))!.dataValues).toStrictEqual({
				uuid,
				id: expect.any(Number),
				installationId: installation.id,

				appId: 12321,
				gitHubAppName: TEST_GHE_APP_PARTIAL.gitHubAppName,
				gitHubBaseUrl: gheUrl,
				gitHubClientId: expect.stringMatching(/client-id.*/i),

				secrets: null,
				privateKey: "encrypted:" + (TEST_GHE_APP_PARTIAL.privateKey as string),
				gitHubClientSecret: "encrypted:" + (TEST_GHE_APP_PARTIAL.gitHubClientSecret as string),
				webhookSecret: "encrypted:" + (TEST_GHE_APP_PARTIAL.webhookSecret as string),

				apiKeyHeaderName: null,
				encryptedApiKeyValue: null,

				createdAt: expect.any(Date),
				updatedAt: expect.any(Date)
			});
		});

		it("successfully creates an item with API key", async () => {
			const uuid = v4();

			const response = await supertest(app)
				.post("/jira/connect/enterprise/app")
				.send({
					... TEST_GHE_APP_PARTIAL,
					uuid,
					apiKeyHeaderName: "myHeader",
					apiKeyValue: "myKey"
				})
				.query({
					jwt: await generateJwt()
				});

			expect(response.status).toStrictEqual(202);
			expect((await GitHubServerApp.findForUuid(uuid))!.dataValues).toEqual(expect.objectContaining(({
				apiKeyHeaderName: "myHeader",
				encryptedApiKeyValue: "encrypted:myKey"
			})));
		});

		it("removes temp config", async () => {
			const tempStorage = new GheConnectConfigTempStorage();
			const uuid = await tempStorage.store({
				serverUrl: "blah"
			}, installation.id);

			await supertest(app)
				.post("/jira/connect/enterprise/app")
				.send({
					... TEST_GHE_APP_PARTIAL,
					uuid
				})
				.query({
					jwt: await generateJwt()
				});

			expect(await tempStorage.get(uuid, installation.id)).toBeNull();
		});
	});
});
