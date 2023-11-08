import { getLogger } from "config/logger";
import { GithubAuthMiddleware } from "routes/github/github-oauth";
import supertest from "supertest";
import nock from "nock";
import { envVars } from "config/env";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { GitHubServerApp } from "models/github-server-app";
import { getFrontendApp } from "~/src/app";
import {
	findOAuthStateInSession,
	findOAuthStateKeyInSession,
	generateSignedSessionCookieHeader,
	parseCookiesAndSession
} from "test/utils/cookies";
import { Installation } from "models/installation";

describe("github-oauth", () => {
	let installation: Installation;
	beforeEach(async () => {
		installation = (await new DatabaseStateCreator().create()).installation;
	});

	describe("GithubOAuthCallbackGet", () => {

		it("must return 400 if no session", async () => {
			const res = await supertest(getFrontendApp())
				.get("/github/callback?blah=true");
			expect(res.status).toEqual(400);
		});

		it("must return 400 if no installation", async () => {
			const res = await supertest(getFrontendApp())
				.get("/github/callback?state=fooState&code=barCode")
				.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
				.set(
					"Cookie",
					generateSignedSessionCookieHeader({
						fooState: {
							installationIdPk: installation.id - 1,
							gitHubClientId: envVars.GITHUB_CLIENT_ID
						}
					})
				);
			expect(res.status).toEqual(400);
		});

		describe("cloud", () => {
			it("must return 400 if no session", async () => {
				const res = await supertest(getFrontendApp())
					.get("/github/callback?blah=true");
				expect(res.status).toEqual(400);
			});

			it("must return 400 if no installation", async () => {
				const res = await supertest(getFrontendApp())
					.get("/github/callback?state=fooState&code=barCode")
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							fooState: {
								installationIdPk: installation.id - 1,
								gitHubClientId: envVars.GITHUB_CLIENT_ID
							}
						})
					);
				expect(res.status).toEqual(400);
			});

			it("populates session with github token", async () => {
				nock("https://github.com")
					.get(`/login/oauth/access_token?client_id=${envVars.GITHUB_CLIENT_ID}&client_secret=${envVars.GITHUB_CLIENT_SECRET}&code=barCode&state=fooState`)
					.matchHeader("accept", "application/json")
					.matchHeader("content-type", "application/json")
					.reply(200, {
						access_token: "behold!"
					});

				const app = await getFrontendApp();
				const response = await supertest(app)
					.get("/github/callback?state=fooState&code=barCode")
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							fooState: {
								postLoginRedirectUrl: "/my-redirect",
								installationIdPk: installation.id,
								gitHubClientId: envVars.GITHUB_CLIENT_ID
							}
						})
					)
				;
				const { session } = parseCookiesAndSession(response);
				expect(response.status).toEqual(302);
				expect(session["githubToken"]).toStrictEqual("behold!");
				expect(response.headers.location).toEqual("/my-redirect");
			});
		});

		describe("server", () => {
			let gitHubServerApp: GitHubServerApp;
			beforeEach(async () => {
				gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
			});

			it("must return 400 if no session", async () => {
				const res = await supertest(getFrontendApp())
					.get(`/github/${gitHubServerApp.uuid}/callback?blah=true`);
				expect(res.status).toEqual(400);
			});

			it("must return 400 if no installation", async () => {
				const res = await supertest(getFrontendApp())
					.get(`/github/${gitHubServerApp.uuid}/callback?state=fooState&code=barCode`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							fooState: {
								installationIdPk: installation.id - 1,
								gitHubClientId: envVars.GITHUB_CLIENT_ID
							}
						})
					);
				expect(res.status).toEqual(400);
			});

			it("populates session with github token, refresh token and server UUID", async () => {
				const nockUrl = `/login/oauth/access_token?client_id=${gitHubServerApp.gitHubClientId}&client_secret=${await gitHubServerApp.getDecryptedGitHubClientSecret(jiraHost)}&code=barCode&state=fooState`;
				nock(gitHubServerApp.gitHubBaseUrl)
					.get(nockUrl)
					.matchHeader("accept", "application/json")
					.matchHeader("content-type", "application/json")
					.reply(200, {
						access_token: "behold!",
						refresh_token: "my-refresh-token"
					});

				const app = await getFrontendApp();
				const response = await supertest(app)
					.get(`/github/${gitHubServerApp.uuid}/callback?state=fooState&code=barCode`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							fooState: {
								postLoginRedirectUrl: "/my-redirect",
								installationIdPk: installation.id,
								gitHubClientId: gitHubServerApp.gitHubClientId,
								gitHubServerUuid: gitHubServerApp.uuid
							}
						})
					)
				;
				const { session } = parseCookiesAndSession(response);
				expect(response.status).toEqual(302);
				expect(session["githubToken"]).toStrictEqual("behold!");
				expect(session["githubRefreshToken"]).toStrictEqual("my-refresh-token");
				expect(session["gitHubUuid"]).toStrictEqual(gitHubServerApp.uuid);
				expect(response.headers.location).toEqual("/my-redirect");
			});
		});
	});

	describe("GithubOAuthLoginGet", () => {
		it("must work only when session is initialized", async () => {
			const res = await supertest(getFrontendApp())
				.get("/github/login?blah=true");
			expect(res.status).toEqual(401);
		});

		it("must work only for Jira admins", async () => {
			const res = await supertest(getFrontendApp())
				.get("/github/login?blah=true")
				.set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost,
						isJiraAdmin: false
					})
				);
			expect(res.status).toEqual(403);
		});

		describe("cloud", () => {
			it("must populate session and redirect to GitHub cloud OAuth", async () => {
				const response = await supertest(getFrontendApp())
					.get("/github/login?")
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost,
							isJiraAdmin: true
						})
					);
				const session = parseCookiesAndSession(response).session;
				const stateKey = findOAuthStateKeyInSession(session);
				expect(stateKey.length).toBeGreaterThan(6);
				expect(response.status).toEqual(302);
				const oauthState = findOAuthStateInSession(session) as any;
				expect(oauthState).toStrictEqual({
					installationIdPk: installation.id,
					postLoginRedirectUrl: "/github/configuration?",
					gitHubClientId: envVars.GITHUB_CLIENT_ID
				});
				const redirectUrl = response.headers.location;
				expect(redirectUrl).toStrictEqual(
					`https://github.com/login/oauth/authorize?client_id=${
						envVars.GITHUB_CLIENT_ID
					}&scope=user%20repo&redirect_uri=${
						encodeURIComponent("https://test-github-app-instance.com/github/callback")
					}&state=${stateKey}`);
			});
		});

		describe("server", () => {
			let gitHubServerApp: GitHubServerApp;
			beforeEach(async () => {
				gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
			});

			it("must populate session and redirect to GitHub server OAuth", async () => {
				const response = await supertest(getFrontendApp())
					.get(`/github/${gitHubServerApp.uuid}/login?`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost,
							isJiraAdmin: true
						})
					);
				const session = parseCookiesAndSession(response).session;
				expect(response.status).toEqual(302);

				const stateKey = findOAuthStateKeyInSession(session);
				expect(stateKey.length).toBeGreaterThan(6);
				expect(response.status).toEqual(302);
				const oauthState = findOAuthStateInSession(session) as any;

				expect(oauthState).toStrictEqual({
					installationIdPk: installation.id,
					postLoginRedirectUrl: "/github/configuration?",
					gitHubClientId: gitHubServerApp.gitHubClientId,
					gitHubServerUuid: gitHubServerApp.uuid
				});
				expect(response.headers.location).toStrictEqual(
					`${gitHubServerApp.gitHubBaseUrl}/login/oauth/authorize?client_id=${
						gitHubServerApp.gitHubClientId
					}&scope=user%20repo&redirect_uri=${
						encodeURIComponent(`https://test-github-app-instance.com/github/${gitHubServerApp.uuid}/callback`)
					}&state=${stateKey}`);
			});
		});
	});

	describe("GithubAuthMiddleware", () => {
		describe("cloud", () => {
			it("must allow call with valid token", async () => {
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

			it("must renew access token if expired", async () => {
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

			it("must redirect to GitHub OAuth if invalid token and cannot be refreshed", async () => {
				githubNock.get("/")
					.matchHeader("Authorization", "Bearer the-token")
					.reply(401);

				nock("https://github.com")
					.post("/login/oauth/access_token")
					.matchHeader("accept", "application/json")
					.matchHeader("content-type", "application/json")
					.reply(401);

				const response = await supertest(getFrontendApp())
					.get(`/github/configuration`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost,
							githubToken: "the-token",
							githubRefreshToken: "blah",
							isJiraAdmin: true
						})
					);
				expect(response.status).toEqual(302);
				expect(response.headers.location).toContain("https://github.com/login/oauth/authorize");
			});
		});

		describe("server", () => {
			let gitHubServerApp: GitHubServerApp;
			beforeEach(async () => {
				gitHubServerApp = await DatabaseStateCreator.createServerApp(installation.id);
			});

			it("must allow call with valid token", async () => {
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

			it("must renew access token if expired", async () => {
				gheNock.post("/login/oauth/access_token")
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
						gitHubAppConfig: {
							gitHubAppId: gitHubServerApp.id,
							uuid: gitHubServerApp.uuid
						},
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

			it("must redirect to GitHub OAuth if invalid token and cannot be refreshed", async () => {
				gheNock
					.post("/login/oauth/access_token")
					.matchHeader("accept", "application/json")
					.matchHeader("content-type", "application/json")
					.reply(401);

				const response = await supertest(getFrontendApp())
					.get(`/github/${gitHubServerApp.uuid}/configuration`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost,
							githubToken: "the-token",
							githubRefreshToken: "blah",
							isJiraAdmin: true
						})
					);
				expect(response.status).toEqual(302);
				expect(response.headers.location).toContain("https://github.mydomain.com/login/oauth/authorize?");
			});
		});

		it("resetGithubToken should clear the session when resetGithubToken is set", async () => {
			const req = {
				log: getLogger("test"),
				query: { resetGithubToken: true, secondParams: true },
				originalUrl: "https://randomsite.com",
				session: { githubToken: "github-token", githubRefreshToken: "refresh-token" }
			};
			const res = {
				locals: {
					gitHubAppConfig: {},
					jiraHost,
					githubToken: ""
				},
				redirect: jest.fn(),
				status:() => ({ json: jest.fn() })
			};
			const next = jest.fn();

			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			await GithubAuthMiddleware(req, res, next);

			expect(req.session.githubToken).toBeUndefined();
			expect(req.session.githubRefreshToken).toBeUndefined();
			expect(res.redirect).toBeCalledWith("https://randomsite.com?secondParams=true");
		});
	});
});
