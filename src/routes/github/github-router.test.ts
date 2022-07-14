import express, {Application} from "express";
import supertest from "supertest";
import { GithubRouter } from "./github-router";
import { getLogger } from "config/logger";
import { when } from  "jest-when";
import {GithubConfigurationGet} from "./configuration/github-configuration-get";
import { getGitHubApiUrl } from "utils/get-github-client-config";
import axios from "axios";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as v4uuid } from 'uuid';

jest.mock("./configuration/github-configuration-get");
jest.mock("utils/get-github-client-config");
jest.mock("axios", () => ({
	get: jest.fn(),
	create: jest.fn()
}));
jest.mock("models/github-server-app");
console.log('', {axios });

const DEFAULT_JIRA_HOST = "https://gh4j.test.atlassian.net";
const VALID_TOKEN = 'valid-token';
const GITHUB_SERVER_APP_UUID: string = v4uuid();
const GITHUB_SERVER_APP_ID = 789;
const GITHUB_SERVER_APP_URL = "https://default.internal.github.atlassian.net";

const getGitHubServerAppModel = (): GitHubServerApp => {
	return {
		id: 1,
		uuid: GITHUB_SERVER_APP_UUID,
		appId: GITHUB_SERVER_APP_ID,
		gitHubBaseUrl: GITHUB_SERVER_APP_URL,
		gitHubClientId: 'client-id',
		gitHubClientSecret: 'client-secret',
		webhookSecret: 'webhook-secret',
		privateKey: 'private-key',
		gitHubAppName: 'test-app-name',
		installationId: 123456,
		updatedAt: new Date(),
		createdAt: new Date()
	} as GitHubServerApp;
}

describe("GitHub router", () => {
	describe("Common route utilities", () => {
		describe("GitHubServer", () => {
			let app: Application;
			beforeEach(() => {
				app = express();
				app.use((req, res, next)=>{
					req.session = { githubToken: VALID_TOKEN };
					res.locals = {jiraHost: DEFAULT_JIRA_HOST};
					req.log = getLogger("test");
					next();
				});
				app.use("/github", GithubRouter);
				when(getGitHubApiUrl)
					.calledWith(DEFAULT_JIRA_HOST, GITHUB_SERVER_APP_UUID)
					.mockResolvedValue(GITHUB_SERVER_APP_URL);
				when(GitHubServerApp.getForGitHubServerAppId)
					.calledWith(GITHUB_SERVER_APP_UUID)
					.mockResolvedValue(getGitHubServerAppModel());
			});
			it("should extract uuid when present", async () => {
				await supertest(app).get(`/github/${GITHUB_SERVER_APP_UUID}/configuration`);
				expect(GithubConfigurationGet).toBeCalledWith();
			});
		});
	});
});
