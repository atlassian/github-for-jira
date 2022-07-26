import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";

describe("GitHubServerApp", () => {

	it("should create a new entry in the GitHubServerApps table", async () => {

		const uuid = newUUID();
		const payload = {
			uuid: uuid,
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 10
		};

		await GitHubServerApp.install(payload);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		expect(savedGitHubServerApp?.gitHubAppName).toEqual("My GitHub Server App");
	});

	it("should find app record by gitHubAppId", async () => {

		const uuid = newUUID();
		const payload = {
			uuid: uuid,
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 10
		};

		await GitHubServerApp.install(payload);
		const savedGitHubServerApp = await GitHubServerApp.getForGitHubServerAppId(123);

		expect(savedGitHubServerApp?.gitHubAppName).toEqual("My GitHub Server App");
	});

	describe("cryptor", () => {
		//--------- helpers
		const defaults = (uuid: string, surfix?: string) => ({
			uuid,
			appId: 123,
			gitHubBaseUrl: "does not matter",
			gitHubClientId: "sample id",
			gitHubAppName: "sample app",
			installationId: 123,
			privateKey: "private-key-plain-text" + (surfix || ""),
			webhookSecret: "webhook-secret-plain-text" + (surfix || ""),
			gitHubClientSecret: "client-secret-plain-text" + (surfix || "")
		});
		describe("cryptor decryption", () => {
			it("should return encrypted text when reading the field properties", async () => {
				const uuid = newUUID();
				const app = await GitHubServerApp.create({
					...defaults(uuid)
				});

				expect(app.privateKey).toBe("encrypted:private-key-plain-text");
				const decryptedPrivateKey = await app.decrypt("privateKey");
				expect(decryptedPrivateKey).toBe("private-key-plain-text");

				expect(app.webhookSecret).toBe("encrypted:webhook-secret-plain-text");
				const decryptedWebhookSecret = await app.decrypt("webhookSecret");
				expect(decryptedWebhookSecret).toBe("webhook-secret-plain-text");

				expect(app.gitHubClientSecret).toBe("encrypted:client-secret-plain-text");
				const decryptedGitHubClient = await app.decrypt("gitHubClientSecret");
				expect(decryptedGitHubClient).toBe("client-secret-plain-text");

			});
		});
		describe("cryptor encryption", () => {
			describe("Single entry", () => {
				it("should convert plain text into encrypted text when calling CREATE", async () => {
					const uuid = newUUID();
					const app = await GitHubServerApp.create({
						...defaults(uuid)
					});
					expect(app.privateKey).toBe("encrypted:private-key-plain-text");
					expect(app.webhookSecret).toBe("encrypted:webhook-secret-plain-text");
					expect(app.gitHubClientSecret).toBe("encrypted:client-secret-plain-text");
				});
				it("should convert plain text into encrypted text when calling UPDATE", async () => {
					const uuid = newUUID();
					const existApp = await GitHubServerApp.install(GitHubServerApp.build({ ...defaults(uuid) }));
					await existApp.update({
						privateKey: "new-private-key-plain-text",
						webhookSecret: "new-webhook-secret-plain-text",
						gitHubClientSecret: "new-client-secret-plain-text"
					});
					expect(existApp.privateKey).toBe("encrypted:new-private-key-plain-text");
					expect(existApp.webhookSecret).toBe("encrypted:new-webhook-secret-plain-text");
					expect(existApp.gitHubClientSecret).toBe("encrypted:new-client-secret-plain-text");
				});
				it("should convert plain text into encrypted text when calling FIND OR CREATE", async () => {
					const uuid = newUUID();
					const [app, created] = await GitHubServerApp.findOrCreate({
						where: {
							uuid: uuid
						},
						defaults: {
							...defaults(uuid)
						}
					});
					expect(created).toBe(true);
					expect(app.privateKey).toBe("encrypted:private-key-plain-text");
					expect(app.webhookSecret).toBe("encrypted:webhook-secret-plain-text");
					expect(app.gitHubClientSecret).toBe("encrypted:client-secret-plain-text");
				});
				it("should convert plain text into encrypted text when calling BUILD and SAVE", async () => {
					const uuid = newUUID();
					const app = GitHubServerApp.build({ ...defaults(uuid) });
					await app.save();
					expect(app.privateKey).toBe("encrypted:private-key-plain-text");
					expect(app.webhookSecret).toBe("encrypted:webhook-secret-plain-text");
					expect(app.gitHubClientSecret).toBe("encrypted:client-secret-plain-text");
				});
			});
			describe("Bulk opreations", () => {
				it("should convert plain text into encrypted text when calling BULK CREATE", async () => {
					const uuid1 = newUUID();
					const uuid2 = newUUID();
					const apps = await GitHubServerApp.bulkCreate([{ ...defaults(uuid1, "-0") }, { ...defaults(uuid2, "-1") }]);
					for (const [i, app] of apps.entries()) {
						expect(app.privateKey).toBe("encrypted:private-key-plain-text-" + i);
						expect(app.webhookSecret).toBe("encrypted:webhook-secret-plain-text-" + i);
						expect(app.gitHubClientSecret).toBe("encrypted:client-secret-plain-text-" + i);
					}
				});
				it("should convert plain text into encrypted text when calling BULK BUILD", async () => {
					const uuid1 = newUUID();
					const uuid2 = newUUID();
					const apps = GitHubServerApp.bulkBuild([{ ...defaults(uuid1, "-0") }, { ...defaults(uuid2, "-1") }]);
					await Promise.all(apps.map(app => app.save()));
					for (const [i, app] of apps.entries()) {
						expect(app.privateKey).toBe("encrypted:private-key-plain-text-" + i);
						expect(app.webhookSecret).toBe("encrypted:webhook-secret-plain-text-" + i);
						expect(app.gitHubClientSecret).toBe("encrypted:client-secret-plain-text-" + i);
					}
				});
			});
		});
	});
});
