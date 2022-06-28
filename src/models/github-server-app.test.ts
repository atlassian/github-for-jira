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

	describe("cryptor encryption", () => {
		beforeEach(() => {
			MockCryptorHttpClient.mockClear();
		});
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
			mockEncryption();
			const app = buildGitHubServerApp();
			await app.setGitHubClientSecret("some_plain_text", getLogger("test"));
			expect(app.gitHubClientSecret).toBe("some_plain_text_encrypted");
		});
		it("should convert plain text into encrypted text when calling setWebhookSecret method", async () => {
			mockEncryption();
			const app = buildGitHubServerApp();
			await app.setWebhookSecret("some_plain_text", getLogger("test"));
			expect(app.webhookSecret).toBe("some_plain_text_encrypted");
		});
		it("should convert plain text into encrypted text when calling setPrivateKey method", async () => {
			mockEncryption();
			const app = buildGitHubServerApp();
			await app.setPrivateKey("some_plain_text", getLogger("test"));
			expect(app.privateKey).toBe("some_plain_text_encrypted");
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
		const mockEncryption = () => {
			MockCryptorHttpClient.mockImplementationOnce(() => {
				return ({
					encrypt: async (_: Logger, plainText: string): Promise<string> => {
						return plainText + "_encrypted";
					}
				} as any) as CryptorHttpClient;
			});
		};
	});
});
