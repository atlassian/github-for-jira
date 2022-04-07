/* eslint-disable jest/expect-expect */
import supertest from "supertest";
import { Installation } from "models/installation";
import { getFrontendApp } from "~/src/app";
import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getSignedCookieHeader } from "test/utils/cookies";
import { envVars }  from "config/env";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

import singleInstallation from "fixtures/jira-configuration/single-installation.json";

describe.each([true, false])("Github Setup - GitHub Client is %s", (useNewGithubClient) => {
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
		const installation_id = 1234;
		beforeEach(async () => {
			await Installation.create({
				jiraHost,
				clientKey: "abc123",
				secrets: "def234",
				sharedSecret: "ghi345"
			});

			when(booleanFlag).calledWith(
				BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GITHUB_SETUP,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(useNewGithubClient);
		});

		it("should return error when missing 'installation_id' from query", async () => {
			await supertest(frontendApp)
				.get("/github/setup")
				.expect(422);
		});

		it("should work with a missing app installation", async () => {
			githubAppTokenNock();
			githubNock
				.get(`/app/installations/${installation_id}`)
				.reply(404);
			await supertest(frontendApp)
				.get("/github/setup")
				.query({ installation_id })
				.expect(200);
		});

		it("should return 200 without jiraHost", async () => {
			githubAppTokenNock();
			githubNock
				.get(`/app/installations/${installation_id}`)
				.reply(200, singleInstallation);
			await supertest(frontendApp)
				.get("/github/setup")
				.query({ installation_id })
				.expect(200);
		});

		it("should return 200 with jiraHost", async () => {
			githubAppTokenNock();
			githubNock
				.get(`/app/installations/${installation_id}`)
				.reply(200, singleInstallation);
			await supertest(frontendApp)
				.get("/github/setup")
				.query({ installation_id })
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.expect(200);
		});
	});

	describe("#POST", () => {
		it("should return a 200 with the redirect url to marketplace if a valid domain is given", async () => {
			jiraNock
				.get("/status")
				.reply(200);

			await supertest(frontendApp)
				.post("/github/setup")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.send({
					jiraDomain: envVars.INSTANCE_NAME
				})
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body.redirect).toBe(`${jiraHost}/jira/marketplace/discover/app/com.github.integration.production`);
				});
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
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.send({
					jiraDomain: envVars.INSTANCE_NAME
				})
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body.redirect).toBe(`${jiraHost}/plugins/servlet/ac/com.github.integration.${envVars.INSTANCE_NAME}/github-post-install-page`);
				});
		});

		it("should return a 400 if no domain is given", () =>
			supertest(frontendApp)
				.post("/github/setup")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.send({})
				.expect(400));

		it("should return a 400 if an empty domain is given", () =>
			supertest(frontendApp)
				.post("/github/setup")
				.set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					})
				)
				.send({
					jiraDomain: ""
				})
				.expect(400));
	});
});
