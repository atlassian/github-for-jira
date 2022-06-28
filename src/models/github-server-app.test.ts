import { GitHubServerApp } from "models/github-server-app";
import { getLogger } from "../config/logger";
import { CryptorHttpClient } from "../util/cryptor-http-client";

jest.mock("../util/cryptor-http-client");
const MockCryptorHttpClient = CryptorHttpClient as jest.Mock<CryptorHttpClient>;

const UUID = "97da6b0e-ec61-11ec-8ea0-0242ac120002";

describe("GitHubServerApp", () => {

	it.skip("should create a new entry in the GitHubServerApps table", async () => {

		const payload = {
			uuid: UUID,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 10
		};

		await GitHubServerApp.install(payload);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(UUID);

		expect(savedGitHubServerApp?.gitHubAppName).toEqual("My GitHub Server App");
	});

	describe("cryptor", () => {
		beforeEach(() => {
			MockCryptorHttpClient.mockClear();
			mockCryptor();
		});
		describe("cryptor encryption", () => {
			it("should throw error if directly setting gitHubClientSecret", async () => {
				expect(() => {
					buildGitHubServerApp({
						gitHubClientSecret: "blah"
					});
				}).toThrowError(/Because of using cryptor/);
			});
			it("should throw error if directly setting webhookSecret", async () => {
				expect(() => {
					buildGitHubServerApp({
						webhookSecret: "blah"
					});
				}).toThrowError(/Because of using cryptor/);
			});
			it("should throw error if directly setting privateKey", async () => {
				expect(() => {
					buildGitHubServerApp({
						privateKey: "blah"
					});
				}).toThrowError(/Because of using cryptor/);
			});
			it("should convert plain text into encrypted text when calling setGitHubClientSecret method", async () => {
				const app = buildGitHubServerApp();
				await app.encryptAndSetGitHubClientSecret("gh_client_secret", getLogger("test"));
				expect(app.gitHubClientSecret).toBe("gh_client_secret_encrypted");
			});
			it("should convert plain text into encrypted text when calling setWebhookSecret method", async () => {
				const app = buildGitHubServerApp();
				await app.encryptAndSetWebhookSecret("webhook_secret", getLogger("test"));
				expect(app.webhookSecret).toBe("webhook_secret_encrypted");
			});
			it("should convert plain text into encrypted text when calling setPrivateKey method", async () => {
				const app = buildGitHubServerApp();
				await app.encryptAndSetPrivateKey("private_key", getLogger("test"));
				expect(app.privateKey).toBe("private_key_encrypted");
			});
		});
		describe("cryptor decryption", () => {
			it("should decrypt gitHubClientSecret", async () => {
				const app = buildGitHubServerApp();
				app.setDataValue("gitHubClientSecret", "gh_client_secret_encrypted");
				expect(await app.decryptAndGetGitHubClientSecret(getLogger("test"))).toBe("gh_client_secret");
			});
			it("should decrypt webhookSecret", async () => {
				const app = buildGitHubServerApp();
				app.setDataValue("webhookSecret", "webhook_secret_encrypted");
				expect(await app.decryptAndGetWebhookSecret(getLogger("test"))).toBe("webhook_secret");
			});
			it("should decrypt privateKey", async () => {
				const app = buildGitHubServerApp();
				app.setDataValue("privateKey", "private_key_encrypted");
				expect(await app.decryptAndGetPrivateKey(getLogger("test"))).toBe("private_key");
			});
		});
		//--------- helpers
		const buildGitHubServerApp = (opts?: any) => {
			return GitHubServerApp.build({
				uuid: UUID,
				gitHubBaseUrl: "does not matter",
				gitHubClientId: "sample id",
				gitHubAppName: "sample app",
				installationId: 123,
				...opts
			});
		};
		const mockCryptor = () => {
			MockCryptorHttpClient.mockImplementationOnce(() => {
				return ({
					encrypt: async (_: Logger, plainText: string): Promise<string> => {
						return plainText + "_encrypted";
					},
					decrypt: async (_: Logger, cipherText: string): Promise<string> => {
						return cipherText.replace("_encrypted", "");
					}
				} as any) as CryptorHttpClient;
			});
		};
	});
});
