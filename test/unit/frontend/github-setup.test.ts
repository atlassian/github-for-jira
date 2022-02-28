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
		beforeEach(async () => {
			await Installation.create({
				jiraHost,
				clientKey: "abc123",
				secrets: "def234",
				sharedSecret: "ghi345",
			});
		});

		it("should return redirect to github oauth flow for GET request if token is missing", async () => {
			await supertest(frontendApp)
				.get("/github/setup")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
					})
				)
				.expect((res) => {
					expect(res.status).toBe(302);
					expect(res.headers.location).toContain(
						"github.com/login/oauth/authorize"
					);
				})
		});

		it("should return redirect to github oauth flow for GET request if token is invalid", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", /^Bearer .+$/)
				.reply(403);

			await supertest(frontendApp)
				.get("/github/setup")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "token",
					})
				)
				.expect((res) => {
					expect(res.status).toBe(302);
					expect(res.headers.location).toContain(
						"github.com/login/oauth/authorize"
					);
				});
		});
	});

	describe("#POST", () => {
		it("should return a 200 with the redirect url to marketplace if a valid domain is given", async () => {
			jiraNock
				.get("/status")
				.reply(200);

			await supertest(frontendApp)
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

			await supertest(frontendApp)
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
