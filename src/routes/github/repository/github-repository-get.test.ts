import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";

const randomString = "random-string";
describe("GitHub Repository Search", () => {
	let app: Application;
	beforeEach(() => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.query = { repoName: randomString };
			req.csrfToken = jest.fn();
			next();
		});
		app.use(getFrontendApp({
			getSignedJsonWebToken: () => "",
			getInstallationAccessToken: async () => ""
		}));
	});
	describe("Testing the Repository Search route", () => {
		it("should redirect to Github login if unauthorized", async () => {
			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost
					}))
				.expect(res => {
					expect(res.status).toBe(302);
					expect(res.headers.location).toContain("github.com/login/oauth/authorize");
				});
		});

		it("should hit the create branch on GET if authorized", async () => {
			githubNock
				.get("/")
				.matchHeader("Authorization", /^(Bearer|token) .+$/i)
				.reply(200);

			githubNock
				.get("/app/installations")
				.reply(200,  [ { account: { login: randomString } } ]);

			const queryString = decodeURIComponent(`${randomString} org:${randomString}`);

			githubNock
				.get(`/search/repositories?q=${queryString}`)
				.reply(200, {
					items: [ { full_name: "first" }, { full_name: "second" } ]
				});

			await supertest(app)
				.get("/github/repository").set(
					"Cookie",
					getSignedCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}))
				.expect(res => {
					expect(res.status).toBe(200);
					expect(res.body?.repositories).toHaveLength(2);
				});
		});
	});
});
