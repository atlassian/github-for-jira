import { Application } from "express";
import { getFrontendApp } from "../../app";
import supertest from "supertest";
import { GithubConfigurationGet } from "./configuration/github-configuration-get";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { v4 as v4uuid } from "uuid";
import { envVars } from "config/env";
import {
	findOAuthStateInSession,
	findOAuthStateKeyInSession,
	generateSignedSessionCookieHeader,
	parseCookiesAndSession
} from "test/utils/cookies";
import * as cookie from "cookie";

jest.mock("./configuration/github-configuration-get");
jest.mock("config/feature-flags");

const VALID_TOKEN = "valid-token";
const GITHUB_SERVER_APP_UUID: string = v4uuid();
const GITHUB_SERVER_APP_ID = Math.floor(Math.random() * 10000);
const GITHUB_SERVER_CLIENT_ID = "client-id";

const prepareGitHubServerAppInDB = async (jiraInstallaionId: number) => {
	const existed = await GitHubServerApp.findForUuid(GITHUB_SERVER_APP_UUID);
	if (existed) return existed;
	return await GitHubServerApp.install({
		uuid: GITHUB_SERVER_APP_UUID,
		appId: GITHUB_SERVER_APP_ID,
		gitHubBaseUrl: gheUrl,
		gitHubClientId: GITHUB_SERVER_CLIENT_ID,
		gitHubClientSecret: "gitHubClientSecret",
		webhookSecret: "webhookSecret",
		privateKey: "privateKey",
		gitHubAppName: "test-app-name",
		installationId: jiraInstallaionId
	}, jiraHost);
};

const setupGitHubCloudPingNock = () =>
	githubNock.get("/").reply(200);


const setupGHEPingNock = () => {
	gheApiNock.get("").reply(200);
};

const prepareNewInstallationInDB = async () => {
	return await Installation.install({
		host: jiraHost,
		sharedSecret: "sharedSecret",
		clientKey: "clientKey"
	});
};

const mockConfigurationGetProceed = ()=>{
	jest.mocked(GithubConfigurationGet).mockClear();
	jest.mocked(GithubConfigurationGet).mockImplementation(async (_req, res) => {
		res.end("ok");
	});
};

describe("GitHub router", () => {
	describe("Common route utilities", () => {
		describe("Cloud scenario", () => {
			let app: Application;
			beforeEach(async() => {
				app = getFrontendApp();
				mockConfigurationGetProceed();
				await Installation.create({
					jiraHost,
					clientKey: "abc123",
					encryptedSharedSecret: "ghi345"
				});
			});
			it("testing the redirect URL in GithubOAuthLoginGet middleware when FF is off", async () => {
				await supertest(app)
					.get(`/github/configuration`)
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost
						})
					)
					.expect(302)
					.then((response) => {
						const resultUrl = response.headers.location;
						const resultUrlWithoutState = resultUrl.split("&state")[0];// Ignoring state here cause state is different everytime
						const redirectUrl = `${envVars.APP_URL}/github/callback`;
						const expectedUrlWithoutState = `https://github.com/login/oauth/authorize?client_id=${envVars.GITHUB_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(redirectUrl)}`;
						expect(resultUrlWithoutState).toEqual(expectedUrlWithoutState);
					});
			});
			it("testing the redirect URL in GithubOAuthLoginGet middleware when FF is on", async () => {
				const response = await supertest(app)
					.get(`/github/configuration`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost
						})
					);

				expect(response.statusCode).toStrictEqual(302);

				const { session } = parseCookiesAndSession(response);
				const oauthState = findOAuthStateInSession(session) as any;
				const oauthStateKey = findOAuthStateKeyInSession(session);

				const resultUrl = response.headers.location;
				const redirectUrl = `${envVars.APP_URL}/github/callback`;
				const expectedUrl = `https://github.com/login/oauth/authorize?client_id=${envVars.GITHUB_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${oauthStateKey}`;

				expect(resultUrl).toEqual(expectedUrl);
				expect(oauthState["postLoginRedirectUrl"]).toStrictEqual(`/github/configuration`);
			});

			it("should skip uuid when absent", async () => {
				setupGitHubCloudPingNock();
				await supertest(app)
					.get(`/github/configuration`)
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost,
							githubToken: VALID_TOKEN
						})
					)
					.expect(200);
				expect(GithubConfigurationGet).toBeCalledWith(
					expect.anything(), //not matching req
					expect.objectContaining({ //matching res locals
						locals: expect.objectContaining({
							githubToken: VALID_TOKEN,
							jiraHost,
							gitHubAppConfig: expect.objectContaining({
								appId: envVars.APP_ID
							})
						})
					}),
					expect.anything()
				);
				expect(GithubConfigurationGet).toBeCalledTimes(1);
				const actualLocals = jest.mocked(GithubConfigurationGet)
					.mock.calls[0][1].locals;
				expect(actualLocals)
					.toEqual(expect.objectContaining({
						githubToken: VALID_TOKEN,
						jiraHost,
						gitHubAppConfig: expect.objectContaining({
							appId: envVars.APP_ID
						})
					}));
			});
			it("should reset token when resetGithubToken was provided", async () => {
				const resp1 = await supertest(app)
					.get(`/github/configuration?resetGithubToken=true`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost,
							githubToken: VALID_TOKEN
						})
					)
					.expect(302);

				expect(resp1.headers.location).toEqual("/github/configuration?");

				const cookies = resp1.headers["set-cookie"].reduce((acc, setCookieString) => {
					const parsed = cookie.parse(setCookieString);
					return Object.assign(acc, parsed);
				}, {});

				// We want to rediect not because GHE responds with a error, but because there is no token in session
				githubNock.get("/").times(0);

				const resp2 = await supertest(app)
					.get("/github/configuration")
					.set(
						"Cookie",
						`session=${cookies.session as string}; session.sig=${cookies["session.sig"] as string}`
					)
					.expect(302);

				const resultUrl = resp2.headers.location;
				const resultUrlWithoutState = resultUrl.split("&state")[0];// Ignoring state here cause state is different everytime
				const redirectUrl = `${envVars.APP_URL}/github/callback`;
				const expectedUrlWithoutState = `https://github.com/login/oauth/authorize?client_id=${envVars.GITHUB_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(redirectUrl)}`;
				expect(resultUrlWithoutState).toEqual(expectedUrlWithoutState);
			});
		});
		describe("GitHubServer", () => {
			let app: Application;
			let jiraInstallaionId: number;
			let gitHubAppId: number;
			beforeEach(async () => {
				app = getFrontendApp();
				const installation = await prepareNewInstallationInDB();
				jiraInstallaionId = installation.id;
				const gitHubApp = await prepareGitHubServerAppInDB(jiraInstallaionId);
				gitHubAppId = gitHubApp.id;
				mockConfigurationGetProceed();
			});
			it("testing the redirect URL in GithubOAuthLoginGet middleware when FF is off", async () => {
				const response = await supertest(app)
					.get(`/github/${GITHUB_SERVER_APP_UUID}/configuration`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost
						})
					);

				const { session } = parseCookiesAndSession(response);
				const oauthState = findOAuthStateInSession(session) as any;
				const oauthStateKey = findOAuthStateKeyInSession(session);

				expect(response.statusCode).toStrictEqual(302);
				const resultUrl = response.headers.location;
				const redirectUrl = `${envVars.APP_URL}/github/${GITHUB_SERVER_APP_UUID}/callback`;
				const expectedUrl = `${gheUrl}/login/oauth/authorize?client_id=${GITHUB_SERVER_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${oauthStateKey}`;
				expect(resultUrl).toEqual(expectedUrl);

				expect(oauthState["postLoginRedirectUrl"]).toStrictEqual(`/github/${GITHUB_SERVER_APP_UUID}/configuration`);
			});

			it("testing the redirect URL in GithubOAuthLoginGet middleware when FF is on", async () => {
				const response = await supertest(app)
					.get(`/github/${GITHUB_SERVER_APP_UUID}/configuration`)
					.set("x-forwarded-proto", "https") // otherwise cookies won't be returned cause they are "secure"
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost
						})
					);

				expect(response.status).toStrictEqual(302);

				const resultUrl = response.headers.location;
				const resultUrlWithoutState = resultUrl.split("&state")[0];// Ignoring state here cause state is different everytime
				const redirectUrl = `${envVars.APP_URL}/github/${GITHUB_SERVER_APP_UUID}/callback`;
				const expectedUrlWithoutState = `${gheUrl}/login/oauth/authorize?client_id=${GITHUB_SERVER_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(redirectUrl)}`;
				expect(resultUrlWithoutState).toEqual(expectedUrlWithoutState);

				const { session } = parseCookiesAndSession(response);
				const oauthState = findOAuthStateInSession(session) as any;
				expect(oauthState["postLoginRedirectUrl"]).toStrictEqual(`/github/${GITHUB_SERVER_APP_UUID}/configuration`);
			});

			it("should extract uuid when present", async () => {
				setupGHEPingNock();
				await supertest(app)
					.get(`/github/${GITHUB_SERVER_APP_UUID}/configuration`)
					.set(
						"Cookie",
						generateSignedSessionCookieHeader({
							jiraHost,
							githubToken: VALID_TOKEN,
							gitHubUuid: GITHUB_SERVER_APP_UUID
						})
					)
					.expect(200);
				expect(GithubConfigurationGet).toBeCalledWith(
					expect.anything(), //not matching req
					expect.objectContaining({ //matching res locals
						locals: expect.objectContaining({
							githubToken: VALID_TOKEN,
							jiraHost,
							gitHubAppId: gitHubAppId,
							gitHubAppConfig: expect.objectContaining({
								appId: String(GITHUB_SERVER_APP_ID),
								uuid: GITHUB_SERVER_APP_UUID
							})
						})
					}),
					expect.anything()
				);
			});
		});
	});
});
