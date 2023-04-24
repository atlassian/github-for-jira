import express, { Express, NextFunction, Request, Response } from "express";
import { Installation } from "models/installation";
import path from "path";
import { registerHandlebarsPartials } from "utils/handlebars/handlebar-partials";
import { RootRouter } from "routes/router";
import { getLogger } from "config/logger";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import supertest from "supertest";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";
import { GitHubServerApp } from "models/github-server-app";
import { registerHandlebarsHelpers } from "utils/handlebars/handlebar-helpers";

describe("JiraConnectEnterpriseAppsGet", () => {
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

	const setupAppInstallationAndInitJwt = async (uuid: string, query: any = {}) => {
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = { installation };
			req.log = getLogger("test");
			req.session = { jiraHost };
			next();
		});
		jwt = encodeSymmetric({
			qsh: createQueryStringHash({
				method: "GET",
				pathname: `/jira/connect/enterprise/${uuid}/app`,
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	describe("unauthorized", () => {

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;

			await setupAppInstallationAndInitJwt("123",{
				foo: "bar"
			});
		});

		it("returns 401 when JWT is invalid", async () => {
			const response = await supertest(app)
				.get("/jira/connect/enterprise/123/app")
				.query({
					jwt
				});
			expect(response.status).toStrictEqual(401);
		});
	});

	describe("no server app, no temp connect config", () => {
		const TEST_UUID = "c7a17b54-2e37-415b-bba1-7d62fa2d2a7f";

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;

			await setupAppInstallationAndInitJwt(TEST_UUID);
		});

		it("response with 404", async () => {
			const response = await supertest(app)
				.get(`/jira/connect/enterprise/${TEST_UUID}/app`)
				.query({
					jwt
				});
			expect(response.status).toStrictEqual(404);
		});
	});

	describe("no server app, temp connect config", () => {
		let testUuid: string;

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;

			testUuid = await new GheConnectConfigTempStorage().store({
				serverUrl: "https://ghe.com"
			}, installation.id);

			await setupAppInstallationAndInitJwt(testUuid);
		});

		it("should render create app selection form", async () => {
			const response = await supertest(app)
				.get(`/jira/connect/enterprise/${testUuid}/app`)
				.query({
					jwt
				});
			expect(response.text).toContain(`<input type="hidden" id="baseUrl" value="https://ghe.com">`);
			expect(response.text).toContain(`class="jiraSelectAppCreation__options__card optionsCard automatic selected"`);
			expect(response.text).toContain(`class="jiraSelectAppCreation__options__card optionsCard manual "`);
		});
	});

	describe("existing server apps", () => {
		let gheApp: GitHubServerApp;

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;
			gheApp = result.gitHubServerApp!;

			await setupAppInstallationAndInitJwt(gheApp.uuid);
		});

		it("should render app selection form with ADD_NEW_APP button", async () => {
			const response = await supertest(app)
				.get(`/jira/connect/enterprise/${gheApp.uuid}/app`)
				.query({
					jwt
				});
			expect(response.text).toMatch(
				new RegExp(`data-qs-for-path=.*${gheApp.uuid}.*data-path="github-app-creation-page"`, "i")
			);
			expect(response.text).toContain(`<div class="selectTable__identifier">${gheApp.gitHubAppName}</div>`);
			expect(response.text).toContain(`data-identifier="${gheApp.uuid}"`);
		});
	});

	describe("with new flag", () => {
		let gheApp: GitHubServerApp;

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;
			gheApp = result.gitHubServerApp!;

			await setupAppInstallationAndInitJwt(gheApp.uuid, { new: "true" });
		});

		it("should render app selection form with ADD_NEW_APP button", async () => {
			const response = await supertest(app)
				.get(`/jira/connect/enterprise/${gheApp.uuid}/app`)
				.query({
					jwt,
					new: "true"
				});
			expect(response.text).toContain(`<input type="hidden" id="baseUrl" value="${gheApp.gitHubBaseUrl}">`);
			expect(response.text).toContain(`class="jiraSelectAppCreation__options__card optionsCard automatic selected"`);
			expect(response.text).toContain(`class="jiraSelectAppCreation__options__card optionsCard manual "`);
		});
	});

});
