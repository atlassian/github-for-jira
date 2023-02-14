
import { getLogger } from "config/logger";
import { ApiConfigurationGet } from "./api-configuration-get";
import { Subscription } from "models/subscription";
import { getConfiguredAppProperties } from  "utils/app-properties-utils";

jest.mock("utils/app-properties-utils", ()=> ({
	getConfiguredAppProperties: jest.fn()
}));

describe("GitHub Configured Get", () => {

	let req, res;
	const INSTALLATION_ID = 123;
	beforeEach(async () => {
		jest.mocked(getConfiguredAppProperties).mockResolvedValue({ data: "things" });

		req = {
			log: getLogger("request"),
			params: {
				installationId: INSTALLATION_ID
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
			hashedClientKey: "key"
		});
	});

	it("Should get configured state", async () => {
		await ApiConfigurationGet(req, res);
		expect(res.status).toBeCalledWith(200);
	});

	it("Should 400 without required fields", async () => {
		delete req.params.installationId;
		await ApiConfigurationGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(400);
	});

	it("Should 404 when subscription can't be found", async () => {
		req.params.installationId = "0";
		await ApiConfigurationGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(404);
	});

});

