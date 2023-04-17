import express, { NextFunction, Request, Response } from "express";
import { getLogger } from "config/logger";
import { GithubAuthMiddleware, GithubOAuthRouter } from "routes/github/github-oauth-router";
import supertest from "supertest";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import nock from "nock";
import { envVars } from "config/env";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";

jest.mock("config/feature-flags");

describe("github-oauth-router", () => {

	describe("GithubOAuthCallbackGet", () => {

		let locals = {};
		let session = {};

		beforeEach(async () => {
			await new DatabaseStateCreator().create();
			locals = {};
			session = {
				jiraHost,
				fooState: `http://myredirect.com?jiraHost=${jiraHost}`
			};
		});

		const createApp = () => {
			const app = express();
			app.use(async (req: Request, res: Response, next: NextFunction) => {
				res.locals = locals;
				req.addLogFields = jest.fn();
				req.log = getLogger("test");
				req.session = session;
				next();
			});
			app.use(GithubServerAppMiddleware);
			app.use("/test", GithubOAuthRouter);
			return app;
		};

		it("populates session with github token", async () => {
			nock("https://github.com")
				.get(`/login/oauth/access_token?client_id=${envVars.GITHUB_CLIENT_ID}&client_secret=${envVars.GITHUB_CLIENT_SECRET}&code=barCode&state=fooState`)
				.matchHeader("accept", "application/json")
				.matchHeader("content-type", "application/json")
				.reply(200, {
					access_token: "behold!"
				});

			const app = await createApp();
			const response = await supertest(app).get("/test/callback?state=fooState&code=barCode");
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			expect(session.githubToken).toEqual("behold!");
			expect(response.status).toEqual(302);
			expect(response.headers.location).toEqual(`http://myredirect.com?jiraHost=${jiraHost}`);
		});
	});

	describe("GithubAuthMiddleware", () => {
		describe("cloud", () => {
			it("with token", async () => {
				githubNock.get("/")
					.matchHeader("Authorization", "Bearer the-token")
					.reply(200, {});

				const next = jest.fn();

				const req = {
					log: getLogger("test"),
					session: {
						githubToken: "the-token"
					}
				};

				const res = {
					locals: {
						gitHubAppConfig: {}
					}
				};

				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				await GithubAuthMiddleware(req, res, next);
				expect(next.mock.calls).toHaveLength(1);
			});

			it("with expired token", async () => {
				githubNock.get("/")
					.matchHeader("Authorization", "Bearer the-token")
					.reply(401);

				nock("https://github.com")
					.post("/login/oauth/access_token")
					.matchHeader("accept", "application/json")
					.matchHeader("content-type", "application/json")
					.reply(200, {
						"access_token": "new_access_token",
						"refresh_token": "new_refresh_token"
					});

				const next = jest.fn();

				const req = {
					log: getLogger("test"),
					session: {
						githubToken: "the-token",
						githubRefreshToken: "refresh-token"
					}
				};

				const res = {
					locals: {
						gitHubAppConfig: {},
						jiraHost,
						githubToken: ""
					}
				};

				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				await GithubAuthMiddleware(req, res, next);
				expect(next.mock.calls).toHaveLength(1);
				expect(req.session.githubToken).toBe("new_access_token");
				expect(req.session.githubRefreshToken).toBe("new_refresh_token");
				expect(res.locals.githubToken).toBe("new_access_token");
			});
		});

		describe("server", () => {
			let gitHubServerApp: GitHubServerApp;
			beforeEach(async () => {
				const creatorResult = await new DatabaseStateCreator().forServer().create();
				gitHubServerApp = creatorResult.gitHubServerApp!;
			});

			it("with token", async () => {
				gheApiNock.get("")
					.matchHeader("Authorization", "Bearer the-token")
					.reply(200, {});

				const next = jest.fn();

				const req = {
					log: getLogger("test"),
					session: {
						githubToken: "the-token"
					}
				};

				const res = {
					locals: {
						jiraHost,
						gitHubAppConfig: {
							gitHubAppId: gitHubServerApp.id
						}
					}
				};

				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				await GithubAuthMiddleware(req, res, next);
				expect(next.mock.calls).toHaveLength(1);
			});
		});
	});
});
