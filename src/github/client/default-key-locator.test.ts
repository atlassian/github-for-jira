import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";
import { defaultKeyLocator } from "~/src/github/client/default-key-locator";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { Subscription } from "~/src/models/subscription";

jest.mock("config/feature-flags");

let privateKey: string | undefined;
describe("default-key-locator", () => {

	beforeEach(async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.GHE_SERVER,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		privateKey = process.env.PRIVATE_KEY;
		process.env.PRIVATE_KEY = "cloud-private-key";

	});

	afterEach(() => {
		process.env.PRIVATE_KEY = privateKey;
	});

	it("should return GHE app private key", async() => {
		const gitHubServerApp= await GitHubServerApp.install({
			uuid: "97da6b0e-ec61-11ec-8ea0-0242ac120002",
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 1
		});

		await Subscription.install({
			host: "http://jira.example.com",
			installationId: 12345,
			clientKey: "client-key",
			gitHubAppId: gitHubServerApp.id
		});
		const privateKey = await defaultKeyLocator({
			appId: 123,
			installationId: 12345,
			githubBaseUrl:"http://example.com"
		});
		expect(privateKey).toBe("myprivatekey");

	});

	it("should return cloud app private key", async() => {
		await Subscription.install({
			host: "http://jira.example.com",
			installationId: 11111,
			clientKey: "client-key"
		});

		const privateKey = await defaultKeyLocator({
			appId: 567,
			installationId: 11111,
			githubBaseUrl:"https://github.com"
		});
		expect(privateKey).toBe("cloud-private-key");

	});

});