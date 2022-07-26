import { Application } from "express";
import { getFrontendApp } from "../../app";
import supertest from "supertest";
import { GithubRouter } from "./github-router";
import { when } from "jest-when";
import { GithubConfigurationGet } from "./configuration/github-configuration-get";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { v4 as v4uuid } from "uuid";
import { envVars } from "config/env";
import { getSignedCookieHeader } from "test/utils/cookies";
import {BooleanFlags, booleanFlag} from "config/feature-flags";

jest.mock("./configuration/github-configuration-get");
jest.mock("models/installation");
jest.mock("config/feature-flags");

const VALID_TOKEN = "valid-token";
const GITHUB_SERVER_APP_UUID: string = v4uuid();
const GITHUB_SERVER_APP_ID = 789;
const JIRA_INSTALLATION_ID = 444444;

const getServerApptInstallationModel = (): Installation => {
	return {
		id: JIRA_INSTALLATION_ID,
		jiraHost,
		secrets: "secrets",
		sharedSecret: "sharedSecret",
		encryptedSharedSecret: "encryptedSharedSecret",
		clientKey: "clientKey",
		updatedAt: new Date(),
		createdAt: new Date(),
		githubAppId: GITHUB_SERVER_APP_ID
	} as Installation;
};

const turnGHE_FF_OnOff = (newStatus: boolean) => {
	when(jest.mocked(booleanFlag))
		.calledWith(BooleanFlags.GHE_SERVER, expect.anything(), expect.anything())
		.mockResolvedValue(newStatus);
}

const setupAppAndRouter = () => {
	return getFrontendApp({
		getSignedJsonWebToken: () => "",
		getInstallationAccessToken: async () => ""
	});
};

const prepreGitHubServerAppInDB = async () => {
	const existed = await GitHubServerApp.findForUuid(GITHUB_SERVER_APP_UUID);
	if(!existed) {
		GitHubServerApp.install({
			uuid: GITHUB_SERVER_APP_UUID,
			appId: GITHUB_SERVER_APP_ID,
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "client-id",
			gitHubClientSecret: "gitHubClientSecret",
			webhookSecret: "webhookSecret",
			privateKey: "privateKey",
			gitHubAppName: "test-app-name",
			installationId: JIRA_INSTALLATION_ID,
		});
	}
};

const setupGitHubCloudPingNock = () => {
	githubNock.get("/").reply(200);
};

const setupGHEPingNock = () => {
	gheNock.get("/").reply(200);
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
		describe.only("Cloud scenario", () => {
			let app: Application;
			beforeEach(() => {
				turnGHE_FF_OnOff(true);
				app = setupAppAndRouter();
				setupGitHubCloudPingNock();
				mockConfigurationGetProceed();
			});
			it("should skip uuid when absent", async () => {
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
				expect(GithubConfigurationGet).toBeCalledTimes(1);
				const actualLocals = jest.mocked(GithubConfigurationGet)
					.mock.calls[0][1].locals;
				expect(actualLocals)
					.toEqual(expect.objectContaining({
						githubToken: VALID_TOKEN,
						jiraHost,
						gitHubAppConfig: expect.objectContaining({
							appId: envVars.APP_ID,
							gitHubClientSecret: envVars.GITHUB_CLIENT_SECRET,
							webhookSecret: envVars.WEBHOOK_SECRET
						})
					}));
			});
		});
		describe("GitHubServer", () => {
			let app: Application;
			beforeEach(async () => {
				app = setupAppAndRouter();
				app.use("/github", GithubRouter);
				await prepreGitHubServerAppInDB();
				setupGHEPingNock();
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
							jiraHost,
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
