import axios from "axios";
import { Installation } from "models/installation";
import express, { Express, NextFunction, Request, Response } from "express";
import { RootRouter } from "../../router";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { encodeSymmetric } from "atlassian-jwt";
import { getGheErrorMessages } from "routes/jira/server/jira-server-url-post";
import { GitHubServerApp } from "models/github-server-app";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Jira Server Url Suite", () => {
	let app: Express;
	let installation: Installation;
	let jwt: string;
	const gheServerURL = "http://mygheurl.com";

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
			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL
				})
				.expect(200)
				.then((res) => {
					expect(axios.get).toHaveBeenCalledWith(gheServerURL);
					expect(res.body).toEqual({ success: true, moduleKey: "github-app-creation-page" });
				});
		});

		it("should return success response with list gh apps page moduleKey when apps are found (mismatched url and id)", async () => {
			const payload = {
				uuid: "97da6b0e-ec61-11ec-8ea0-0242ac120002",
				appId: 123,
				gitHubAppName: "My GitHub Server App",
				gitHubBaseUrl: gheServerURL,
				gitHubClientId: "lvl.1234",
				gitHubClientSecret: "myghsecret",
				webhookSecret: "mywebhooksecret",
				privateKey: "myprivatekey",
				installationId: 1
			};
			await GitHubServerApp.install(payload);

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL
				})
				.expect(200)
				.then((res) => {
					expect(axios.get).toHaveBeenCalledWith(gheServerURL);
					expect(res.body).toEqual({ success: true, moduleKey: "github-app-creation-page" });
				});
		});

		it("should return success response with list gh apps page moduleKey when apps are found (matching url and id)", async () => {
			const payload = {
				uuid: "97da6b0e-ec61-11ec-8ea0-0242ac120002",
				appId: 123,
				gitHubAppName: "My GitHub Server App",
				gitHubBaseUrl: gheServerURL,
				gitHubClientId: "lvl.1234",
				gitHubClientSecret: "myghsecret",
				webhookSecret: "mywebhooksecret",
				privateKey: "myprivatekey",
				installationId: installation.id
			};
			await GitHubServerApp.install(payload);

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL
				})
				.expect(200)
				.then((res) => {
					expect(axios.get).not.toHaveBeenCalledWith(gheServerURL);
					expect(res.body).toEqual({ success: true, moduleKey: "github-list-apps-page" });
				});
		});
	});

	describe("Failure responses", () => {
		it("should return error message when invalid url is sent in request", async () => {
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
					const { errorCode, message } = getGheErrorMessages("invalidUrl");
					expect(res.body).toEqual({ success: false, errorCode, message });
				});
		});

		it("should return error message when unable to make a request to URL", async () => {
			mockedAxios.get.mockImplementationOnce(() =>
				Promise.reject({
					message: "getaddrinfo ENOTFOUND github.internal.atlassian.com",
					name: "Error",
					code: "ENOTFOUND",
					status: null
				})
			);

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL
				})
				.expect(200)
				.then((res) => {
					const { errorCode, message } = getGheErrorMessages("ENOTFOUND");
					expect(res.body).toEqual({ success: false, errorCode, message });
				});
		});

		it("should return 502 error when there is a server or connection error", async () => {
			mockedAxios.get.mockImplementationOnce(() =>
				Promise.reject({ status: 502 })
			);

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL
				})
				.expect(502)
				.then((res) => {
					const { errorCode, message } = getGheErrorMessages(502);
					expect(res.body).toEqual({ success: false, errorCode, message });
				});
		});

		it("should return default error for all other errors", async () => {
			mockedAxios.get.mockImplementationOnce(() =>
				Promise.reject({ error: "Oh no! This didn't work for some unknown reason :(" })
			);

			return supertest(app)
				.post("/jira/server-url")
				.send({
					installationId: installation.id,
					jiraHost,
					jwt,
					gheServerURL
				})
				.expect(200)
				.then((res) => {
					const { errorCode, message } = getGheErrorMessages("someothererror");
					expect(res.body).toEqual({ success: false, errorCode, message });
				});
		});
	});
});
