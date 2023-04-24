import express, { Express, NextFunction, Request, Response } from "express";
import { Installation } from "models/installation";
import path from "path";
import { registerHandlebarsPartials }  from "utils/handlebars/handlebar-partials";
import { registerHandlebarsHelpers } from "utils/handlebars/handlebar-helpers";
import { RootRouter } from "routes/router";
import { getLogger } from "config/logger";
import { encodeSymmetric } from "atlassian-jwt";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import supertest from "supertest";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";

describe("github-manifest-get", () => {
	let app: Express;
	let installation: Installation;
	let jwt: string;

	beforeEach(() => {
		app = express();
		app.set("view engine", "hbs");
		const viewPath = path.resolve(process.cwd(), "views");
		app.set("views", viewPath);
		registerHandlebarsPartials(path.resolve(viewPath, "partials"));
		registerHandlebarsHelpers();
		app.use(RootRouter);
	});

	const setupAppInstallationAndInitJwt = async () => {
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
	};

	describe("unauthorized", () => {

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;

			jwt = "boo";
		});

		it("returns 401 when JWT is invalid", async () => {
			const response = await supertest(app)
				.get("/github/manifest/123")
				.query({
					jwt
				});
			expect(response.status).toStrictEqual(401);
		});
	});

	describe("from temp storage", () => {
		let uuid: string;

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;

			uuid = await new GheConnectConfigTempStorage().store({
				serverUrl: "http://ghe.com"
			}, installation.id);

			await setupAppInstallationAndInitJwt();
		});

		it("uses the provided UUID in URLs", async () => {
			const response = await supertest(app)
				.get(`/github/manifest/${uuid}`)
				.query({
					jwt
				});
			expect(response.text).toContain(`"redirect_url": "https://test-github-app-instance.com/github/manifest/complete/${uuid}"`);
			expect(response.text).toContain(`"https://test-github-app-instance.com/github/${uuid}/webhooks"`);
			expect(response.text).toContain(`"setup_url": "https://test-github-app-instance.com/github/${uuid}/setup"`);
			expect(response.text).toContain(`"callback_url": "https://test-github-app-instance.com/github/${uuid}/callback"`);
			expect(response.text).toContain(`"action": "http://ghe.com/settings/apps/new"`);
		});
	});

	describe("from existing server", () => {
		let uuid: string;
		let gheUrl: string;

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;
			gheUrl = result.gitHubServerApp!.gitHubBaseUrl;

			uuid = result.gitHubServerApp!.uuid;

			await setupAppInstallationAndInitJwt();
		});

		it("uses new UUID in URLs and copies config to temp storage", async () => {
			const response = await supertest(app)
				.get(`/github/manifest/${uuid}`)
				.query({
					jwt
				});
			const newUuid = response.text.split("test-github-app-instance.com/github/manifest/complete/")[1].split("\"")[0];
			expect(response.text).not.toContain(uuid);
			expect(response.text).toContain(`"redirect_url": "https://test-github-app-instance.com/github/manifest/complete/${newUuid}"`);
			expect(response.text).toContain(`"https://test-github-app-instance.com/github/${newUuid}/webhooks"`);
			expect(response.text).toContain(`"setup_url": "https://test-github-app-instance.com/github/${newUuid}/setup"`);
			expect(response.text).toContain(`"callback_url": "https://test-github-app-instance.com/github/${newUuid}/callback"`);
			expect(response.text).toContain(`"action": "${gheUrl}/settings/apps/new"`);

			expect((await new GheConnectConfigTempStorage().get(newUuid, installation.id))!.serverUrl).toStrictEqual(gheUrl);
		});
	});

});
