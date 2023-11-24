import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { ApiDummySubscriptionDelete } from "routes/api/subscription/api-dummy-subscription-delete";

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
		await ApiDummySubscriptionDelete(req, res);
		const subscription = await Subscription.findOneForGitHubInstallationId(12345, undefined);
		expect(subscription).toBeNull();
		expect(saveConfiguredAppProperties).toBeCalledWith(jiraHost, expect.anything(), false);
		expect(res.status).toBeCalledWith(200);
	});
});
