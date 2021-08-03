import supertest from "supertest";
import express from "express";
import healthcheck from "../../../src/frontend/healthcheck";
import setupFrontend from "../../../src/frontend/app";
import {MockFeatureFlags} from "../config/feature-flags-mock";

jest.mock("launchdarkly-node-server-sdk");

describe("Maintenance", () => {
	let app;
	beforeEach(async () => {
		await new MockFeatureFlags()
			.withFlag("maintenance-mode", "https://maintenance.atlassian.net", true)
			.withFlag("maintenance-mode", "https://nomaintenance.atlassian.net", false)
			.init();
		app = express();
	});

	describe("Healthcheck", () => {
		beforeEach(() => {
			app.use("/", healthcheck);
		});
		it("should still work in maintenance mode", () =>
			supertest(app)
				.get("/healthcheck")
				.expect(200));

		it("deepcheck should still work in maintenance mode", () =>
			supertest(app)
				.get("/deepcheck")
				.expect(200));
	});

	describe("Frontend", () => {
		beforeEach(() => {
			app.use("/", setupFrontend({
				getSignedJsonWebToken: () => undefined,
				getInstallationAccessToken: () => undefined
			}));
		});
		describe("Jira", () => {
			it("should return a 200 status code when in maintenance mode", () =>
				supertest(app)
					.get("/jira/atlassian-connect.json")
					.expect(200)
					.then(response => {
						expect(response.status).toBe(200);
					}));

			it("should return a 200 status code when not in maintenance mode", () => {
				return supertest(app)
					.get("/jira/atlassian-connect.json")
					.expect(200);
			});
		});

		describe("Admin API", () => {
			beforeEach(() => {
				githubNock
					.post("/graphql")
					.reply(200, {
						data: {
							viewer: {
								login: "monalisa",
								organization: {
									viewerCanAdminister: true
								}
							}
						}
					});
			});

			it("should still work in maintenance mode", () =>
				supertest(app)
					.get("/api")
					.set("Authorization", "Bearer xxx")
					.expect(200));
		});

		describe("Maintenance", () => {
			it("should return maintenance page on '/maintenance' even if maintenance mode is off", () => {
				return supertest(app)
					.get("/maintenance")
					.expect(503)
					.then(response => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return 503 for any frontend routes to a jira host in maintenance mode", () =>
				supertest(app)
					.get("/github/configuration?xdm_e=https://maintenance.atlassian.net")
					.expect(503));

			it("should return 302 for any frontend routes to a jira host NOT in maintenance mode", () =>
				supertest(app)
					.get("/github/configuration?xdm_e=https://nomaintenance.atlassian.net")
					.expect(302));

			it("should still be able to get static assets in maintenance mode", () =>
				supertest(app)
					.get("/public/maintenance.svg?xdm_e=https://maintenance.atlassian.net")
					.set("Accept", "image/svg+xml")
					.expect("Content-Type", "image/svg+xml")
					.expect(200)
					.then(response => {
						expect(response.body).toMatchSnapshot();
					}));
		});
	});
});
