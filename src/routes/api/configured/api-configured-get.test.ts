
import { getLogger } from "config/logger";
import { ApiConfiguredGet } from "./api-configured-get";
import { Subscription } from "models/subscription";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { when } from "jest-when";

describe("GitHub Configured Get", () => {

	let req, res;
	const INSTALLATION_ID = 123;
	let mockJiraClient;
	beforeEach(async () => {

		req = {
			log: getLogger("request"),
			params: {
				owner: "ARC",
				repo: "repo-1"
			}
		};

		res = {
			sendStatus: jest.fn(),
			send: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				gitHubAppConfig: {}
			}
		};

		await Subscription.install({
			installationId: INSTALLATION_ID,
			host: jiraHost,
			gitHubAppId: undefined,
			clientKey: "key"
		});

		mockJiraClient = {
			devinfo: {
				appProperties: {
					get: jest.fn()
				}
			}
		};
	});

	it("Should get configured state", async () => {
		when(jest.mocked(getJiraClient))
			.calledWith(jiraHost, INSTALLATION_ID, expect.anything(), expect.anything())
			.mockResolvedValue(mockJiraClient);

		await ApiConfiguredGet(req, res);
		expect(res.status).toBeCalledWith(200);
		expect(mockJiraClient.devinfo.appProperties.get).toBeCalled();
	});

	// it.each(["githubToken", "gitHubAppConfig"])("Should 401 without permission attributes", async (attribute) => {
	// 	delete res.locals[attribute];
	// 	await ApiConfiguredGet(req, res);
	// 	expect(res.sendStatus).toHaveBeenCalledWith(401);
	// });
	//
	// it.each(["owner", "repo"])("Should 400 when missing required fields", async (attribute) => {
	// 	res.status.mockReturnValue(res);
	// 	delete req.params[attribute];
	// 	await ApiConfiguredGet(req, res);
	// 	expect(res.status).toHaveBeenCalledWith(400);
	// });

});

