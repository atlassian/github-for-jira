
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { ApiConfigurationPost } from "routes/api/configuration/api-configuration-post";

jest.mock("utils/app-properties-utils", ()=> ({
	saveConfiguredAppProperties: jest.fn()
}));

describe("GitHub Configured Get", () => {

	let req, res;
	const JIRAHOST_A = "HOST1";
	const JIRAHOST_B = "HOST2";
	const JIRAHOST_C = "HOST3";
	beforeEach(async () => {
		jest.mocked(saveConfiguredAppProperties).mockResolvedValue();

		req = {
			log: getLogger("request"),
			body: {
				jiraHosts: [
					JIRAHOST_A
				]
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
			installationId: 1,
			host: JIRAHOST_A,
			gitHubAppId: undefined,
			clientKey: "key"
		});

		await Subscription.install({
			installationId: 2,
			host: JIRAHOST_B,
			gitHubAppId: undefined,
			clientKey: "key"
		});
	});

	it("Should save configured state", async () => {
		await ApiConfigurationPost(req, res);
		expect(saveConfiguredAppProperties).toBeCalledTimes(1);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should save multiple installations configured state regardless of subscription existance", async () => {
		req.body.jiraHosts = [ JIRAHOST_A, JIRAHOST_C ];
		await ApiConfigurationPost(req, res);
		expect(saveConfiguredAppProperties).toBeCalledTimes(2);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should save false for no subscriptions", async () => {
		req.body.jiraHosts = [ JIRAHOST_C ];
		await ApiConfigurationPost(req, res);
		expect(saveConfiguredAppProperties).toBeCalledWith(JIRAHOST_C, undefined, undefined, expect.anything(), false);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should save true for subscription present", async () => {
		req.body.jiraHosts = [ JIRAHOST_A ];
		await ApiConfigurationPost(req, res);
		expect(saveConfiguredAppProperties).toBeCalledWith(JIRAHOST_A, undefined, undefined, expect.anything(), true);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should 400 when no installationid's are provided", async () => {
		req.body.jiraHosts = [];
		await ApiConfigurationPost(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.send).toHaveBeenCalledWith("please provide installation ids to update!");
	});

	it("Should 400 when too many installationid's are provided", async () => {
		req.body.jiraHosts = Array.from(Array(100).keys());
		await ApiConfigurationPost(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.send).toHaveBeenCalledWith("Calm down Cowboy, keep it under 50 at a time!");
	});

});

