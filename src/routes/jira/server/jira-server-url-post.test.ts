import { Installation } from "models/installation";
import express, { Express, NextFunction, Request, Response } from "express";
import { RootRouter } from "../../router";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { encodeSymmetric } from "atlassian-jwt";
import { gheServerUrlErrors } from "routes/jira/server/jira-server-url-post";
import { GitHubServerApp } from "models/github-server-app";

describe("Jira Server Url Suite", () => {
	let app: Express;
	let installation: Installation;
	let jwt: string;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "client-key"
		});
		app = express();
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = { installation };
			req.log = getLogger("test");
			req.session = { jiraHost };
			next();
		});
		app.use(RootRouter);

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: jiraHost
		}, installation.sharedSecret);
	});

	describe("Successful responses", () => {
		it("should return success response with app creation page moduleKey when no apps are found and request to gheServerURL succeeds", async () => {
			gheNock.get("/").reply(200);
			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL: gheUrl
				})
				.expect(200)
				.then((res) => {
					expect(res.body).toEqual({ success: true, appExists: false });
				});
		});

		it("should return success response with list gh apps page moduleKey when apps are found (mismatched url and id)", async () => {
			gheNock.get("/").reply(200);
			await GitHubServerApp.install({
				uuid: "97da6b0e-ec61-11ec-8ea0-0242ac120002",
				appId: 123,
				gitHubAppName: "My GitHub Server App",
				gitHubBaseUrl: gheUrl,
				gitHubClientId: "lvl.1234",
				gitHubClientSecret: "myghsecret",
				webhookSecret: "mywebhooksecret",
				privateKey: "myprivatekey",
				installationId: 1
			});

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL: gheUrl
				})
				.expect(200)
				.then((res) => {
					expect(res.body).toEqual({ success: true, appExists: false });
				});
		});

		it("should return success response with list gh apps page moduleKey when apps are found (matching url and id)", async () => {
			await GitHubServerApp.install({
				uuid: "97da6b0e-ec61-11ec-8ea0-0242ac120002",
				appId: 123,
				gitHubAppName: "My GitHub Server App",
				gitHubBaseUrl: gheUrl,
				gitHubClientId: "lvl.1234",
				gitHubClientSecret: "myghsecret",
				webhookSecret: "mywebhooksecret",
				privateKey: "myprivatekey",
				installationId: installation.id
			});

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL: gheUrl
				})
				.expect(200)
				.then((res) => {
					expect(res.body).toEqual({ success: true, appExists: true });
				});
		});
	});

	describe("Failure responses", () => {
		it("should send error message when invalid url is sent in request", async () => {
			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL: "notaurl"
				})
				.expect(200)
				.then((res) => {
					const { errorCode, message } = gheServerUrlErrors.invalidUrl;
					expect(res.body).toEqual({ success: false, errors: [{ code: errorCode, message }] });
				});
		});

		it("should send error message when unable to make a request to URL", async () => {
			gheNock.get("/").replyWithError({
				message: "getaddrinfo ENOTFOUND github.internal.atlassian.com",
				name: "Error",
				code: "ENOTFOUND",
				status: null
			});

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL: gheUrl
				})
				.expect(200)
				.then((res) => {
					const { errorCode, message } = gheServerUrlErrors.ENOTFOUND;
					expect(res.body).toEqual({ success: false, errors: [{ code: errorCode, message }] });
				});
		});

		it("should sent error message when there is a server or connection error", async () => {
			gheNock.get("/").reply(502);

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL: gheUrl
				})
				.expect(200)
				.then((res) => {
					const { errorCode, message } = gheServerUrlErrors[502];
					expect(res.body).toEqual({ success: false, errors: [{ code: errorCode, message }] });
				});
		});

		it("should send default error message for all other errors", async () => {
			gheNock.get("/").reply(400, { error: "Oh no! This didn't work for some unknown reason :(" });

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL: gheUrl
				})
				.expect(200)
				.then((res) => {
					const { errorCode, message } = gheServerUrlErrors.default;
					expect(res.body).toEqual({ success: false, errors: [{ code: errorCode, message }] });
				});
		});
	});
});
