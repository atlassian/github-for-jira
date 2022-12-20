import { keyLocator } from "~/src/github/client/key-locator";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { envVars } from "~/src/config/env";
import { readFileSync } from "fs";

jest.mock("config/feature-flags");

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
		}, jiraHost);

		const privateKey = await keyLocator(gitHubServerApp.id, jiraHost);
		expect(privateKey).toBe("myprivatekey");

	});

	it("should return cloud app private key using PRIVATE_KEY_PATH", async () => {
		const privateKeyContents = readFileSync(`${process.cwd()}/test/setup/test-key.pem`, "utf-8");
		const privateKey = await keyLocator(undefined, jiraHost);
		expect(privateKey).toBe(privateKeyContents);

	});

	it("should throw error on invalid private key path", async () => {
		const envPrivateKeyPath = envVars.PRIVATE_KEY_PATH;
		process.env.PRIVATE_KEY_PATH = "cloud-private-key-invalid-path.pem";

		await expect(keyLocator(undefined, jiraHost)).rejects.toThrow("Private key does not exists");
		process.env.PRIVATE_KEY_PATH = envPrivateKeyPath;

	});

	it("should return cloud app private key using PRIVATE_KEY", async () => {
		const privateKetCert = `-----BEGIN RSA PRIVATE KEY-----
		privatekeycertificate
		-----END RSA PRIVATE KEY-----`;
		const envPrivateKey = envVars.PRIVATE_KEY;
		process.env.PRIVATE_KEY = privateKetCert;
		const privateKey = await keyLocator(undefined, jiraHost);
		expect(privateKey).toBe(privateKetCert);
		process.env.PRIVATE_KEY = envPrivateKey;
	});

	it("should return cloud app private key using  Base64 encoded PRIVATE_KEY", async () => {
		const privateKetCert = `-----BEGIN RSA PRIVATE KEY-----
		privatekeycertificate
		-----END RSA PRIVATE KEY-----`;
		const encodedPrivateKey = Buffer.from(privateKetCert).toString("base64");
		const envPrivateKey = envVars.PRIVATE_KEY;
		process.env.PRIVATE_KEY = encodedPrivateKey;
		const privateKey = await keyLocator(undefined, jiraHost);
		expect(privateKey).toBe(privateKetCert);
		process.env.PRIVATE_KEY = envPrivateKey;
	});

});

