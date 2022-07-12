import { keyLocator } from "~/src/github/client/key-locator";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { existsSync, readFileSync } from "fs";
import { mocked } from "ts-jest/utils";
import { envVars } from "~/src/config/env";

jest.mock("config/feature-flags");
jest.mock("fs");

describe("key-locator", () => {

	it("should return GHE app private key", async () => {
		const gitHubServerApp = await GitHubServerApp.install({
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

		const privateKey = await keyLocator(gitHubServerApp.id);
		expect(privateKey).toBe("myprivatekey");

	});

	it("should return cloud app private key using PRIVATE_KEY_PATH", async () => {
		mocked(existsSync).mockReturnValue(true);
		mocked(readFileSync).mockReturnValue("my-private-key-from-key-path");

		const privateKey = await keyLocator();
		expect(readFileSync).toBeCalled();
		expect(privateKey).toBe("my-private-key-from-key-path");

	});

	it("should return cloud app private key using PRIVATE_KEY", async () => {
		const envPrivateKey = envVars.PRIVATE_KEY;
		envVars.PRIVATE_KEY = "cloud-private-key";

		const privateKey = await keyLocator();
		expect(privateKey).toBe("cloud-private-key");
		envVars.PRIVATE_KEY = envPrivateKey;

	});

	it("should throw error on invalid private key path", async () => {
		const envPrivateKeyPath = process.env.PRIVATE_KEY_PATH;
		process.env.PRIVATE_KEY_PATH = "cloud-private-key-invalid-path.pem";

		await expect(keyLocator()).rejects.toThrow("Private key does not exists");
		process.env.PRIVATE_KEY_PATH = envPrivateKeyPath;

	});

});