import express, { Application } from "express";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { getFrontendApp } from "~/src/app";
import { getSignedCookieHeader } from "test/utils/cookies";
import { SearchRepositoriesQuery, UserOrganizationsQuery } from "~/src/github/client/github-queries";

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
				.post("/graphql", { query: UserOrganizationsQuery, variables: { first: 10 } })
				.reply(200, { data: { viewer: { login: randomString, organizations: { nodes: [] } } } });
			const queryString = `${randomString} org:${randomString} in:name sort:updated-desc`;
			githubNock
				.post("/graphql", { query: SearchRepositoriesQuery, variables: { query_string: queryString, per_page: 20 } })
				.reply(200, { data: { search: { repos: [ 1, 2 ] } } });

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
