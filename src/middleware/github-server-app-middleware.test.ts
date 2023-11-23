import Mock = jest.Mock;
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { getLogger } from "config/logger";
import { GitHubServerApp } from "../models/github-server-app";
import { Installation } from "models/installation";
import { when } from "jest-when";

jest.mock("models/installation");
jest.mock("models/github-server-app");

const GIT_HUB_SERVER_APP_ID = 123;
const GIT_HUB_SERVER_APP_APP_ID = "789";
const UUID = "97da6b0e-ec61-11ec-8ea0-0242ac120002";
const JIRA_INSTALLATION_ID = 1;

describe("github-server-app-middleware", () => {

	let req;
	let res;
	let resStatus: Mock;
	let resJson: Mock;
	let next: Mock;
	let installation;
	let payload;

	beforeEach(async () => {
		next = jest.fn();
		resJson = jest.fn();
		resStatus = jest.fn(()=> ({
			json: resJson
		}));
		res = {
			locals: {
				jiraHost: "https://testatlassian.net"
			},
			status: resStatus
		};

		req = {
			log: getLogger("request"),
			addLogFields: jest.fn(),
			params: {}
		};
	});

	it("should call next() when no uuid is provided", async () => {
		await GithubServerAppMiddleware(req, res, next);
		expect(next).toBeCalledTimes(1);
	});

	it("should throw an error if an uuid is provided but no GitHub server app is found", async () => {
		req.params.uuid = UUID;
		await GithubServerAppMiddleware(req, res, next);
		expect(resStatus).toBeCalledWith(404);
		expect(resJson).toBeCalledWith({ message: "No GitHub app found for provided id." });
	});

	it("should throw an error if an uuid is provided and a GitHub server app is found but the installation id doesn't match", async () => {
		req.params.uuid = UUID;

		payload = {
			uuid: UUID,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: JIRA_INSTALLATION_ID
		};

		installation = {
			jiraHost: "https://testatlassian.com",
			id: JIRA_INSTALLATION_ID + 1
		};

		when(Installation.findByPk)
			.expectCalledWith(JIRA_INSTALLATION_ID as any)
			.mockResolvedValue(installation);
		when(GitHubServerApp.findForUuid)
			.expectCalledWith(UUID)
			.mockResolvedValue(payload);

		await GithubServerAppMiddleware(req, res, next);
		expect(resStatus).toBeCalledWith(401);
		expect(resJson).toBeCalledWith({ message: "Jira hosts do not match." });
	});

	it("should call next() when GH app is found and installation id matches", async () => {
		req.params.uuid = UUID;

		payload = {
			id: GIT_HUB_SERVER_APP_ID,
			uuid: UUID,
			appId: GIT_HUB_SERVER_APP_APP_ID,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "encrypted:myghsecret",
			webhookSecret: "encrypted:mywebhooksecret",
			privateKey: "encrypted:myprivatekey",
			installationId: JIRA_INSTALLATION_ID,
			decrypt: async (s: any) => s
		};

		installation = {
			jiraHost: "https://testatlassian.net",
			id: JIRA_INSTALLATION_ID,
			clientKey: "testkey"
		};

		when(Installation.findByPk)
			.expectCalledWith(JIRA_INSTALLATION_ID as any)
			.mockResolvedValue(installation);
		when(GitHubServerApp.findForUuid)
			.expectCalledWith(UUID)
			.mockResolvedValue(payload);

		await GithubServerAppMiddleware(req, res, next);

		expect(next).toBeCalledTimes(1);

		expect(res.locals.gitHubAppId).toBe(GIT_HUB_SERVER_APP_ID);
		expect(res.locals.gitHubAppConfig).toEqual({
			gitHubAppId: GIT_HUB_SERVER_APP_ID,
			appId: GIT_HUB_SERVER_APP_APP_ID,
			uuid: UUID,
			clientId: "lvl.1234",
			hostname: "http://myinternalserver.com"
		});
	});
});
