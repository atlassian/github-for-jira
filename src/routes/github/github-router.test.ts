import express, { Application } from "express";
import supertest from "supertest";
import { GithubRouter } from "./github-router";
import { getLogger } from "config/logger";
import { when } from "jest-when";
import { GithubConfigurationGet } from "./configuration/github-configuration-get";
import { getGitHubApiUrl } from "utils/get-github-client-config";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { v4 as v4uuid } from "uuid";
import { envVars } from "config/env";

jest.mock("./configuration/github-configuration-get");
jest.mock("utils/get-github-client-config");
jest.mock("axios", () => ({ get: jest.fn(), create: jest.fn() }));
jest.mock("models/github-server-app");
jest.mock("models/installation");

const JIRA_HOST = "https://gh4j.test.atlassian.net";
const VALID_TOKEN = "valid-token";
const GITHUB_SERVER_APP_UUID: string = v4uuid();
const GITHUB_SERVER_APP_ID = 789;
const GITHUB_SERVER_APP_URL = "https://default.internal.github.atlassian.net";
const JIRA_INSTALLATION_ID = 444444;

const getGitHubServerAppModel = (): GitHubServerApp => {
	return {
		id: 1,
		uuid: GITHUB_SERVER_APP_UUID,
		appId: GITHUB_SERVER_APP_ID,
		gitHubBaseUrl: GITHUB_SERVER_APP_URL,
		gitHubClientId: "client-id",
		gitHubClientSecret: "gitHubClientSecret",
		webhookSecret: "webhookSecret",
		privateKey: "privateKey",
		gitHubAppName: "test-app-name",
		installationId: JIRA_INSTALLATION_ID,
		updatedAt: new Date(),
		createdAt: new Date(),
		decrypt: async (s) => s
	} as GitHubServerApp;
};

const getServerApptInstallationModel = (): Installation => {
	return {
		id: JIRA_INSTALLATION_ID,
		jiraHost: JIRA_HOST,
		secrets: "secrets",
		sharedSecret: "sharedSecret",
		encryptedSharedSecret: "encryptedSharedSecret",
		clientKey: "clientKey",
		updatedAt: new Date(),
		createdAt: new Date(),
		githubAppId: GITHUB_SERVER_APP_ID
	} as Installation;
};

const mockPrerequistApp = () => {
	const app = express();
	app.use((req, res, next) => {
		req.session = { githubToken: VALID_TOKEN };
		res.locals = { jiraHost: JIRA_HOST };
		req.log = getLogger("test");
		next();
	});
	return app;
};

const mockGetGitHubApiUrl = () => {
	when(getGitHubApiUrl)
		.calledWith(JIRA_HOST, GITHUB_SERVER_APP_ID)
		.mockResolvedValue(GITHUB_SERVER_APP_URL);
};

const mockGetForGitHubServerAppId = () => {
	when(GitHubServerApp.findForUuid)
		.calledWith(GITHUB_SERVER_APP_UUID)
		.mockResolvedValue(getGitHubServerAppModel());
};

const mockAxiosPingURL = () => {
	when(axios.get)
		.calledWith(JIRA_HOST)
		.mockResolvedValue(undefined);
};

const mockInstallationFindByPK = () => {
	when(Installation.findByPk)
		.calledWith(JIRA_INSTALLATION_ID as any)
		.mockResolvedValue(getServerApptInstallationModel());
};

const mockConfigurationGetProceed = ()=>{
	jest.mocked(GithubConfigurationGet).mockClear();
	jest.mocked(GithubConfigurationGet).mockImplementation(async (_req, res) => {
		res.end("ok");
	});
};

describe("GitHub router", () => {
	describe("Common route utilities", () => {
		describe("Cloud scenario", ()=>{
			let app: Application;
			beforeEach(() => {
				app = mockPrerequistApp();
				app.use(`/github`, GithubRouter);
				mockConfigurationGetProceed();
			});
			it("should skip uuid when absent", async () => {
				await supertest(app)
					.get(`/github/configuration`)
					.expect(200);
				expect(GithubConfigurationGet).toBeCalledWith(
					expect.anything(), //not matching req
					expect.objectContaining({ //matching res locals
						locals: expect.objectContaining({
							githubToken: VALID_TOKEN,
							jiraHost: JIRA_HOST,
							gitHubAppConfig: expect.objectContaining({
								appId: envVars.APP_ID,
								gitHubClientSecret: envVars.GITHUB_CLIENT_SECRET,
								webhookSecret: envVars.WEBHOOK_SECRET
							})
						})
					}),
					expect.anything()
				);
			});
		});
		describe("GitHubServer", () => {
			let app: Application;
			beforeEach(() => {
				app = mockPrerequistApp();
				app.use("/github", GithubRouter);
				mockGetGitHubApiUrl();
				mockGetForGitHubServerAppId();
				mockAxiosPingURL();
				mockInstallationFindByPK();
				mockConfigurationGetProceed();
			});
			it("should extract uuid when present", async () => {
				await supertest(app)
					.get(`/github/${GITHUB_SERVER_APP_UUID}/configuration`)
					.expect(200);
				expect(GithubConfigurationGet).toBeCalledWith(
					expect.anything(), //not matching req
					expect.objectContaining({ //matching res locals
						locals: expect.objectContaining({
							githubToken: VALID_TOKEN,
							jiraHost: JIRA_HOST,
							gitHubAppId: GITHUB_SERVER_APP_ID,
							gitHubAppConfig: expect.objectContaining({
								appId: GITHUB_SERVER_APP_ID,
								uuid: GITHUB_SERVER_APP_UUID,
								gitHubClientSecret: "gitHubClientSecret",
								webhookSecret: "webhookSecret",
								privateKey: "privateKey"
							})
						})
					}),
					expect.anything()
				);
			});
			it("should not match route, return empty if uuid present but invalid", async ()=>{
				await supertest(app)
					.get(`/github/${GITHUB_SERVER_APP_UUID + "random-gibberish"}/configuration`)
					.expect(404);
				expect(GithubConfigurationGet).not.toHaveBeenCalled();
			});
		});
	});
});
