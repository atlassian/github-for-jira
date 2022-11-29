
import { getLogger } from "config/logger";
import { Subscription } from "models/subscription";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";
import { ApiConfiguredPost } from "routes/api/configured/api-configured-post";

jest.mock("utils/app-properties-utils", ()=> ({
	saveConfiguredAppProperties: jest.fn()
}));

describe("GitHub Configured Get", () => {

	let req, res;
	const INSTALLATION_ID_A = 123;
	const INSTALLATION_ID_B = 456;
	const INSTALLATION_ID_C = 789;
	beforeEach(async () => {
		jest.mocked(saveConfiguredAppProperties).mockResolvedValue();

		req = {
			log: getLogger("request"),
			body: {
				installationIds: [
					INSTALLATION_ID_A
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
			installationId: INSTALLATION_ID_A,
			host: jiraHost,
			gitHubAppId: undefined,
			clientKey: "key"
		});

		await Subscription.install({
			installationId: INSTALLATION_ID_B,
			host: jiraHost,
			gitHubAppId: undefined,
			clientKey: "key"
		});
	});

	it("Should save configured state", async () => {
		await ApiConfiguredPost(req, res);
		expect(saveConfiguredAppProperties).toBeCalledTimes(1);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should save multiple installations configured state", async () => {
		req.body.installationIds = [ INSTALLATION_ID_A, INSTALLATION_ID_B ];
		await ApiConfiguredPost(req, res);
		expect(saveConfiguredAppProperties).toBeCalledTimes(2);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should only save valid multiple installations configured state", async () => {
		req.body.installationIds = [ INSTALLATION_ID_A, INSTALLATION_ID_B, INSTALLATION_ID_C ];
		await ApiConfiguredPost(req, res);
		expect(saveConfiguredAppProperties).toBeCalledTimes(2);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should 400 when no installationid's are provided", async () => {
		req.body.installationIds = [];
		await ApiConfiguredPost(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.send).toHaveBeenCalledWith("please provide installation ids to update!");
	});

	it("Should 400 when too many installationid's are provided", async () => {
		req.body.installationIds = Array.from(Array(100).keys());
		await ApiConfiguredPost(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.send).toHaveBeenCalledWith("Calm down Cowboy, keep it under 500 at a time!");
	});

});

