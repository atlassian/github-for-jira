import supertest from "supertest";
import express, { Express } from "express";
import { getFrontendApp } from "../../app";
import { getLogger } from "config/logger";

describe("Session GET", () => {
	let app: Express;

	beforeEach(() => {
		app = express();
		app.use((request, _, next) => {
			request.log = getLogger("test");
			next();
		});
	});

	describe("Frontend", () => {
		beforeEach(() => {
			app.use(getFrontendApp({
				getSignedJsonWebToken: () => "",
				getInstallationAccessToken: async () => ""
			}));
		});

		describe("Testing session for GHE", () => {
			it("should return ghe-loading.hbs", () =>
				supertest(app)
					.get("/session/enterprise/jira/atlassian-connect.json")
					.expect(200)
					.then(response => {
						expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeTruthy();
						expect(response.text.includes("Redirecting to your GitHub Cloud instance")).toBeFalsy();
					}));

			it("should return error asking for redirect url", () =>
				supertest(app)
					.get("/session/enterprise")
					.expect(400)
					.then(response => {
						expect(response.text.includes("Missing redirect url for session enterprise")).toBeTruthy();
						expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
						expect(response.text.includes("Redirecting to your GitHub Cloud instance")).toBeFalsy();
					}));
		});

		describe("Testing session for Cloud", () => {
			it("should return ghe-loading.hbs", () =>
				supertest(app)
					.get("/session/jira/atlassian-connect.json")
					.expect(200)
					.then(response => {
						expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
						expect(response.text.includes("Redirecting to your GitHub Cloud instance")).toBeTruthy();
					}));
			it("should return error asking for redirect url", () =>
				supertest(app)
					.get("/session")
					.expect(400)
					.then(response => {
						expect(response.text.includes("Missing redirect url for session cloud")).toBeTruthy();
						expect(response.text.includes("Redirecting to your GitHub Enterprise Server instance")).toBeFalsy();
						expect(response.text.includes("Redirecting to your GitHub Cloud instance")).toBeFalsy();
					}));
		});
	});
});
