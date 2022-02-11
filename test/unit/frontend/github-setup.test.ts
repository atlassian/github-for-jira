import supertest from "supertest";
import { Installation } from "../../../src/models";
import { getFrontendApp } from "../../../src/app";
import { getLogger } from "../../../src/config/logger";
import express, { Application } from "express";
import { getSignedCookieHeader } from "../../utils/cookies";
import envVars from "../../../src/config/env";

describe("Github Setup", () => {
	let frontendApp: Application;

	beforeEach(async () => {
		frontendApp = express();
		frontendApp.use((request, _, next) => {
			request.log = getLogger("test");
			next();
		});
		frontendApp.use(getFrontendApp({
			getSignedJsonWebToken: () => "",
			getInstallationAccessToken: async () => "access-token"
		}));
	});

	describe("#GET", () => {
		it("should return HTML when jiraHost is missing", async () =>
			supertest(frontendApp)
				.get("/github/setup")
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.headers["content-type"]).toContain("text/html");
				}));

		it("should return HTML when jiraHost is set but no corresponding Installations exists", async () =>
			supertest(frontendApp)
				.get("/github/setup")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.headers["content-type"]).toContain("text/html");
				}));
	});

	describe("#POST", () => {
		it("should return a 200 with the redirect url to marketplace if a valid domain is given", async () => {
			jiraNock
				.get("/status")
				.reply(200);

			return supertest(frontendApp)
				.post("/github/setup")
				.send({
					jiraDomain: envVars.INSTANCE_NAME
				})
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body.redirect).toBe(`${jiraHost}/jira/marketplace/discover/app/com.github.integration.production`);
				})
		});

		it("should return a 200 with the redirect url to the app if a valid domain is given and an installation already exists", async () => {
			await Installation.create({
				jiraHost,
				secrets: "secret",
				sharedSecret: "sharedSecret",
				clientKey: "clientKey"
			});

			jiraNock
				.get("/status")
				.reply(200);

			return supertest(frontendApp)
				.post("/github/setup")
				.send({
					jiraDomain: envVars.INSTANCE_NAME
				})
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body.redirect).toBe(`${jiraHost}/plugins/servlet/ac/com.github.integration.${envVars.INSTANCE_NAME}/github-post-install-page`);
				})
		});

		it("should return a 400 if no domain is given", () =>
			supertest(frontendApp)
				.post("/github/setup")
				.send({})
				.expect(400));

		it("should return a 400 if an empty domain is given", () =>
			supertest(frontendApp)
				.post("/github/setup")
				.send({
					jiraDomain: ""
				})
				.expect(400));
	});
});
