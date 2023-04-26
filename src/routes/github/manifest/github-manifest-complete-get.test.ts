import { Installation } from "~/src/models/installation";
import { getLogger } from "config/logger";
import express, { Express, NextFunction, Request, Response } from "express";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { encodeSymmetric } from "atlassian-jwt";
import supertest from "supertest";
import path from "path";
import { registerHandlebarsPartials } from "utils/handlebars/handlebar-partials";
import { registerHandlebarsHelpers } from "utils/handlebars/handlebar-helpers";
import { RootRouter } from "routes/router";
import { GitHubServerApp } from "models/github-server-app";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

describe("github-manifest-complete-get", () => {
	let app: Express;
	let installation: Installation;
	let gheServerApp: GitHubServerApp;
	let jwt: string;

	beforeEach(async () => {
		const result = await (new DatabaseStateCreator()).forServer().create();
		installation = result.installation;
		gheServerApp = result.gitHubServerApp!;

		app = express();
		app.set("view engine", "hbs");
		const viewPath = path.resolve(process.cwd(), "views");
		app.set("views", viewPath);
		registerHandlebarsPartials(path.resolve(viewPath, "partials"));
		registerHandlebarsHelpers();
		app.use(RootRouter);

		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = { installation };
			req.log = getLogger("test");
			req.session = { jiraHost };
			next();
		});

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	});

	it("returns unauthorized when JWT is invalid", async () => {
		const response = await supertest(app)
			.get("/github/manifest/complete/123?code=123")
			.query({
				jwt: "boo"
			});
		expect(response.status).toStrictEqual(401);
	});

	it("Should throw error if not connect config was found", async () => {
		const TEST_UUID = "c7a17b54-2e37-415b-bba1-7d62fa2d2a7f";
		const response = await supertest(app)
			.get(`/github/manifest/complete/${TEST_UUID}?code=123`)
			.query({
				jwt
			});
		expect(response.status).toStrictEqual(404);
	});

	it("Should throw error for existing GHE", async () => {
		const uuid = await new GheConnectConfigTempStorage().store({
			serverUrl: gheServerApp.gitHubBaseUrl
		}, installation.id);
		gheServerApp.uuid = uuid;
		await gheServerApp.save();

		const response = await supertest(app)
			.get(`/github/manifest/complete/${uuid}?code=123`)
			.query({
				jwt
			});
		expect(response.status).toStrictEqual(400);
	});

	it("should throw error if code not provided", async () => {
		const uuid = await new GheConnectConfigTempStorage().store({
			serverUrl: gheServerApp.gitHubBaseUrl
		}, installation.id);

		const response = await supertest(app)
			.get(`/github/manifest/complete/${uuid}`)
			.query({
				jwt
			});
		expect(response.status).toStrictEqual(400);
	});

	it("should complete app manifest flow", async () => {
		gheApiNock
			.post("/app-manifests/123/conversions")
			.reply(200, {
				id: "100",
				name: "github-for-jira",
				client_id: "client_id_test",
				client_secret: "client_secret_test",
				webhook_secret: "webhook_secret_test",
				pem: "private_key_test"
			});

		const uuid = await new GheConnectConfigTempStorage().store({
			serverUrl: gheServerApp.gitHubBaseUrl
		}, installation.id);

		const response = await supertest(app)
			.get(`/github/manifest/complete/${uuid}?code=123`)
			.query({
				jwt
			});

		expect(response.status).toStrictEqual(302);
		expect(response.headers.location).toStrictEqual(`/github/${uuid}/configuration`);

		const githubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(githubServerApp).toEqual(expect.objectContaining({
			appId: 100,
			gitHubAppName: "github-for-jira",
			gitHubClientId: "client_id_test",
			gitHubBaseUrl: "https://github.mydomain.com"
		}));
		const webhookSecret = await githubServerApp?.getDecryptedWebhookSecret(jiraHost);
		expect(webhookSecret).toEqual("webhook_secret_test");
		const clientSecret = await githubServerApp?.getDecryptedGitHubClientSecret(jiraHost);
		expect(clientSecret).toEqual("client_secret_test");
		const privateKey = await githubServerApp?.getDecryptedPrivateKey(jiraHost);
		expect(privateKey).toEqual("private_key_test");
	});

});
