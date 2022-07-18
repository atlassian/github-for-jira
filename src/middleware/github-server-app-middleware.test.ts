import Mock = jest.Mock;
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { getLogger } from "config/logger";
import { mocked } from "ts-jest/utils";
import { GitHubServerApp } from "../models/github-server-app";
import { Installation } from "models/installation";

jest.mock("models/installation");
jest.mock("models/github-server-app");

const UUID = "97da6b0e-ec61-11ec-8ea0-0242ac120002";

describe("github-server-app-middleware", () => {

	let req;
	let res;
	let next: Mock;
	let installation;
	let payload;

	beforeEach(async () => {
		next = jest.fn();
		res = {
			locals: {
				jiraHost: "https://testatlassian.net"
			}
		};
	});

	it("should call next() when no gitHupAppId is provided",  async() => {
		req = {
			log: getLogger("request"),
			params: {
				id: undefined
			}
		};

		await GithubServerAppMiddleware(req, res, next);
		expect(next).toBeCalledTimes(1);
	});

	it("should throw an error if an id is provided but no GitHub server app is found", async () => {
		req = {
			log: getLogger("request"),
			params: {
				uuid: 3
			}
		};

		await expect(GithubServerAppMiddleware(req, res, next))
			.rejects
			.toThrow("No GitHub app found for provided id.");
	});

	it("should throw an error if an id is provided and a GitHub server app is found but the installation id doesn't match",  async() => {
		req = {
			log: getLogger("request"),
			params: {
				uuid: UUID
			}
		};

		payload = {
			uuid: UUID,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 2
		};

		installation = {
			jiraHost: "https://testatlassian.com",
			id: 19
		};

		mocked(Installation.findByPk).mockResolvedValue(installation);
		mocked(GitHubServerApp.findForUuid).mockResolvedValue(
			payload
		);

		await expect(GithubServerAppMiddleware(req, res, next))
			.rejects
			.toThrow("Jira hosts do not match");
	});

	it("should call next() when GH app is found and installation id matches", async () => {
		req = {
			log: getLogger("request"),
			params: {
				uuid: 3
			}
		};

		payload = {
			uuid: UUID,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 19
		};

		installation = {
			jiraHost: "https://testatlassian.net",
			id: 19,
			clientKey: "testkey"
		};

		mocked(Installation.findByPk).mockResolvedValue(installation);
		mocked(GitHubServerApp.findForUuid).mockResolvedValue(
			payload
		);

		await GithubServerAppMiddleware(req, res, next);
		expect(next).toBeCalledTimes(1);
	});
});
