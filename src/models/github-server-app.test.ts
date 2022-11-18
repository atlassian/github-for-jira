import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";

describe("GitHubServerApp", () => {
	const uuid = newUUID();
	const jiraClientKey = "jiraClientKey1";
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

	it("should create a new entry in the GitHubServerApps table", async () => {

		await GitHubServerApp.install(payload, jiraClientKey);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		expect(savedGitHubServerApp?.gitHubAppName).toEqual("My GitHub Server App");
	});

	describe("GHES function", () => {
		it("should NOT update missing columns if it is not specified in the request body", async () => {

			await GitHubServerApp.install(payload, jiraClientKey);

			const payLoadWithoutSomeColumns = {
				uuid: uuid,
				appId: 123,
				privateKey: undefined //some specified as with undefined
				//some specified as missing the key ( so undefined as well )
			};

			await GitHubServerApp.updateGitHubAppByUUID(payLoadWithoutSomeColumns, jiraClientKey);

			const app = await GitHubServerApp.findForUuid(uuid);

			expect(app).toBeDefined();
			expect(app).toEqual(expect.objectContaining({
				uuid: uuid,
				appId: 123,
				gitHubAppName: "My GitHub Server App",
				gitHubBaseUrl: "http://myinternalserver.com",
				gitHubClientId: "lvl.1234",
				gitHubClientSecret: "encrypted:myghsecret",
				webhookSecret: "encrypted:mywebhooksecret",
				privateKey: "encrypted:myprivatekey",
				installationId: 10
			}));
		});
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
					const existApp = await GitHubServerApp.install(GitHubServerApp.build({ ...defaults(uuid) }), jiraClientKey);
					await existApp.update({
						privateKey: "new-private-key-plain-text",
						webhookSecret: "new-webhook-secret-plain-text",
						gitHubClientSecret: "new-client-secret-plain-text"
					});
					expect(existApp.privateKey).toBe("encrypted:new-private-key-plain-text");
					expect(existApp.webhookSecret).toBe("encrypted:new-webhook-secret-plain-text");
					expect(existApp.gitHubClientSecret).toBe("encrypted:new-client-secret-plain-text");
				});

			});

			describe("GitHubServerApp creation", ()=>{
				const GITHUHB_INSTALLATION_ID = 100001;
				const UUID1 = newUUID();
				const UUID2 = newUUID();
				const GHES_URL = "http://private-ghes-server.com";
				const ANOTHER_GHES_URL = "http://another-private-ghes-server.com";
				const DEFAULT_INSTALL_PAYLOAD = {
					uuid: UUID1,
					appId: 123,
					gitHubBaseUrl: GHES_URL,
					gitHubClientId: "client_id",
					gitHubClientSecret: "client_secret_1",
					webhookSecret: "webhook_secret_1",
					privateKey: "private_key_1",
					gitHubAppName: "ghes_app_1",
					installationId: GITHUHB_INSTALLATION_ID
				};
				it("should install new record Successfully", async ()=>{
					const newApp = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD
					}, jiraClientKey);
					const found = await GitHubServerApp.findByPk(newApp.id);
					expect(found).toEqual(expect.objectContaining({
						uuid: UUID1,
						appId: 123,
						gitHubBaseUrl: GHES_URL,
						gitHubClientId: "client_id",
						gitHubClientSecret: "encrypted:client_secret_1",
						webhookSecret: "encrypted:webhook_secret_1",
						privateKey: "encrypted:private_key_1",
						gitHubAppName: "ghes_app_1",
						installationId: GITHUHB_INSTALLATION_ID
					}));
				});
				it("should return existing but NOT override existing record if found", async ()=>{
					const existing = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID1,
						installationId: GITHUHB_INSTALLATION_ID
					}, jiraClientKey);
					const found = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID2, //this indicate even if it is a new uuid, it will override existing
						installationId: GITHUHB_INSTALLATION_ID + 1
					}, jiraClientKey);
					expect(found.id).toBe(existing.id);
					expect(found.installationId).toBe(GITHUHB_INSTALLATION_ID);
				});
				it("should NOT match existing record if url not match", async ()=>{
					const existing = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID1,
						gitHubBaseUrl: GHES_URL
					}, jiraClientKey);
					const newApp = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID2, //need this as the uuid is unique.
						gitHubBaseUrl: ANOTHER_GHES_URL
					}, jiraClientKey);
					expect(newApp.id).not.toBe(existing.id);
				});
			});

			describe("GitHubServerApp update", () => {
				const gitHubBaseUrl = "http://myinternalinstance.com";
				const installationId = 42;
				const uuid = "c97806fc-c433-4ad5-b569-bf5191590be2";
				const originalClientId = "lvl.1n23j12389wndd";
				const originalWebhookSecret = "anothersecret";
				const originalPrivateKey = "privatekey";
				const newClientId = "lvl.1n23j12389wnde";
				const newWebhookSecret = "anewsecret";
				const newPrivateKey = "privatekeyversion2";
				let gitHubServerApp;

				beforeEach(async () => {
					gitHubServerApp = await GitHubServerApp.create({
						uuid,
						appId: 1,
						gitHubAppName: "my awesome app",
						gitHubBaseUrl,
						gitHubClientId: originalClientId,
						gitHubClientSecret: "secret",
						webhookSecret: originalWebhookSecret,
						privateKey: originalPrivateKey,
						installationId
					});
				});

				it("should update GitHub app when uuid is found", async () => {
					const originalApp = await GitHubServerApp.findForUuid(uuid);
					expect(originalApp?.gitHubClientId).toEqual(originalClientId);
					expect(await originalApp?.getDecryptedWebhookSecret(jiraClientKey)).toEqual(originalWebhookSecret);
					expect(await originalApp?.getDecryptedPrivateKey(jiraClientKey)).toEqual(originalPrivateKey);

					await GitHubServerApp.updateGitHubAppByUUID({
						uuid,
						appId: 1,
						gitHubAppName: "my awesome app",
						gitHubBaseUrl,
						gitHubClientId: newClientId,
						gitHubClientSecret: "secret",
						webhookSecret: newWebhookSecret,
						privateKey: newPrivateKey,
						installationId
					}, jiraClientKey);

					const updatedApp = await GitHubServerApp.findForUuid(uuid);
					expect(updatedApp?.uuid).toEqual(gitHubServerApp.uuid);
					expect(updatedApp?.gitHubClientId).toEqual(newClientId);
					expect(await updatedApp?.getDecryptedWebhookSecret(jiraClientKey)).toEqual(newWebhookSecret);
					expect(await updatedApp?.getDecryptedPrivateKey(jiraClientKey)).toEqual(newPrivateKey);
				});

				it("should not update GitHub app when uuid is not found", async () => {
					const mismatchedUUID = "c97806fc-c433-4ad5-b569-bf5191590ba9";

					await GitHubServerApp.updateGitHubAppByUUID({
						uuid: mismatchedUUID,
						appId: 1,
						gitHubAppName: "my awesome app",
						gitHubBaseUrl,
						gitHubClientId: newClientId,
						gitHubClientSecret: "secret",
						webhookSecret: newWebhookSecret,
						privateKey: newPrivateKey,
						installationId
					}, jiraClientKey);

					const updatedApp = await GitHubServerApp.findForUuid(mismatchedUUID);
					expect(updatedApp?.uuid).not.toEqual(gitHubServerApp.uuid);
					expect(updatedApp?.gitHubClientId).not.toEqual(newClientId);
					expect(updatedApp?.webhookSecret).not.toEqual(newWebhookSecret);
					expect(await updatedApp?.getDecryptedWebhookSecret(jiraClientKey)).not.toEqual(newWebhookSecret);
					expect(await updatedApp?.getDecryptedPrivateKey(jiraClientKey)).not.toEqual(newPrivateKey);
				});

				it("should only update values changed and leave other values as is", async () => {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					await GitHubServerApp.updateGitHubAppByUUID({ uuid, appId: 1, gitHubBaseUrl, webhookSecret: newWebhookSecret });
					const myApp = await GitHubServerApp.findForUuid(uuid);

					expect(myApp?.uuid).toEqual(uuid);
					expect(myApp?.appId).toEqual(gitHubServerApp.appId);
					expect(myApp?.gitHubBaseUrl).toEqual(gitHubServerApp.gitHubBaseUrl);
					expect(await myApp?.getDecryptedWebhookSecret(jiraClientKey)).toEqual(newWebhookSecret);
					expect(myApp?.gitHubAppName).toEqual(gitHubServerApp.gitHubAppName);
					expect(await myApp?.getDecryptedPrivateKey(jiraClientKey)).toEqual(originalPrivateKey);
				});
			});
		});
	});

	it("getDecryptedPrivateKey should return decrypted value", async () => {
		await GitHubServerApp.install(payload, jiraClientKey);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(savedGitHubServerApp!.privateKey).toEqual("encrypted:myprivatekey");
		expect(await savedGitHubServerApp!.getDecryptedPrivateKey(jiraClientKey)).toEqual("myprivatekey");
	});

	it("getDecryptedGitHubClientSecret should return decrypted value", async () => {
		await GitHubServerApp.install(payload, jiraClientKey);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(savedGitHubServerApp!.gitHubClientSecret).toEqual("encrypted:myghsecret");
		expect(await savedGitHubServerApp!.getDecryptedGitHubClientSecret(jiraClientKey)).toEqual("myghsecret");
	});

	it("getDecryptedWebhookSecret should return decrypted value", async () => {
		await GitHubServerApp.install(payload, jiraClientKey);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(savedGitHubServerApp!.webhookSecret).toEqual("encrypted:mywebhooksecret");
		expect(await savedGitHubServerApp!.getDecryptedWebhookSecret(jiraClientKey)).toEqual("mywebhooksecret");
	});
});
