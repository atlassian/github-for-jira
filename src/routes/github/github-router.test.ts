import { Application } from "express";
import { getFrontendApp } from "../../app";
import supertest from "supertest";
import { GithubConfigurationGet } from "./configuration/github-configuration-get";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { v4 as v4uuid } from "uuid";
import { envVars } from "config/env";
import { getSignedCookieHeader } from "test/utils/cookies";

jest.mock("./configuration/github-configuration-get");
jest.mock("config/feature-flags");

const VALID_TOKEN = "valid-token";
const GITHUB_SERVER_APP_UUID: string = v4uuid();
const GITHUB_SERVER_APP_ID = Math.floor(Math.random() * 10000);
const GITHUB_SERVER_CLIENT_ID = "client-id";

const setupAppAndRouter = () => {
	return getFrontendApp();
};

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

const setupGitHubCloudPingNock = () => {
	githubNock.get("/").reply(200);
};

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
			beforeEach(() => {
				app = setupAppAndRouter();
				mockConfigurationGetProceed();
			});
			it("testing the redirect URL in GithubOAuthLoginGet middleware", async () => {
				await supertest(app)
					.get(`/github/configuration`)
					.set(
						"Cookie",
						getSignedCookieHeader({
							jiraHost,
							githubToken: VALID_TOKEN
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
			it("should skip uuid when absent", async () => {
				setupGitHubCloudPingNock();
				await supertest(app)
					.get(`/github/configuration`)
					.set(
						"Cookie",
						getSignedCookieHeader({
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
		});
		describe("GitHubServer", () => {
			let app: Application;
			let jiraInstallaionId: number;
			let gitHubAppId: number;
			beforeEach(async () => {
				app = setupAppAndRouter();
				const installation = await prepareNewInstallationInDB();
				jiraInstallaionId = installation.id;
				const gitHubApp = await prepareGitHubServerAppInDB(jiraInstallaionId);
				gitHubAppId = gitHubApp.id;
				mockConfigurationGetProceed();
			});
			it("testing the redirect URL in GithubOAuthLoginGet middleware", async () => {
				await supertest(app)
					.get(`/github/${GITHUB_SERVER_APP_UUID}/configuration`)
					.set(
						"Cookie",
						getSignedCookieHeader({
							jiraHost,
							githubToken: VALID_TOKEN
						})
					)
					.expect(302)
					.then((response) => {
						const resultUrl = response.headers.location;
						const resultUrlWithoutState = resultUrl.split("&state")[0];// Ignoring state here cause state is different everytime
						const redirectUrl = `${envVars.APP_URL}/github/${GITHUB_SERVER_APP_UUID}/callback`;
						const expectedUrlWithoutState = `${gheUrl}/login/oauth/authorize?client_id=${GITHUB_SERVER_CLIENT_ID}&scope=user%20repo&redirect_uri=${encodeURIComponent(redirectUrl)}`;
						expect(resultUrlWithoutState).toEqual(expectedUrlWithoutState);
					});
			});
			it("should extract uuid when present", async () => {
				setupGHEPingNock();
				await supertest(app)
					.get(`/github/${GITHUB_SERVER_APP_UUID}/configuration`)
					.set(
						"Cookie",
						getSignedCookieHeader({
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
								appId: GITHUB_SERVER_APP_ID,
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
