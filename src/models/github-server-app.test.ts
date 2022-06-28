import { GitHubServerApp } from "models/github-server-app";

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
		const buildGitHubServerApp = (opts: any) => {
			return GitHubServerApp.build({
				uuid: UUID,
				gitHubBaseUrl: "does not matter",
				gitHubClientId: "sample id",
				gitHubAppName: "sample app",
				installationId: 123,
				...opts
			});
		};
	});
});
