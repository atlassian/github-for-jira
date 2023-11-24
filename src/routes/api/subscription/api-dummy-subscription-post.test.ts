import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { getLogger } from "config/logger";
import { ApiDummySubscriptionPost } from "routes/api/subscription/api-dummy-subscription-post";
import { Subscription } from "models/subscription";

jest.mock("utils/app-properties-utils", ()=> ({
	saveConfiguredAppProperties: jest.fn()
}));

describe("Testing Dummy Subscription Post", function () {
	let req, res;
	const jiraHost = "MY_DUMMY_JIRA_HOST";

	beforeEach(async () => {
		jest.mocked(saveConfiguredAppProperties).mockResolvedValue();

		req = {
			log: getLogger("request"),
			params: { jiraHost }
		};

		res = {
			sendStatus: jest.fn(),
			send: jest.fn(),
			status: jest.fn(),
			json: jest.fn()
		};
	});

	it("should create a dummy Subscription and set configured state to true", async () => {
		await ApiDummySubscriptionPost(req, res);
		const subscription = await Subscription.findOneForGitHubInstallationId(12345, undefined);
		expect(saveConfiguredAppProperties).toBeCalledWith(jiraHost, expect.anything(), true);
		expect(res.status).toBeCalledWith(200);
		expect(subscription?.jiraHost).toBe(jiraHost);
	});
});
