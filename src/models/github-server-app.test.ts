import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";

describe("GitHubServerApp", () => {
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
		installationId: 10,
		apiKeyHeaderName: "FOO",
		encryptedApiKeyValue: "encrypted:api_key"
	};

	it("should create a new entry in the GitHubServerApps table", async () => {

		await GitHubServerApp.install(payload, jiraHost);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);

		expect(savedGitHubServerApp?.gitHubAppName).toEqual("My GitHub Server App");
	});

	describe("GHES function", () => {
		it("should NOT update missing columns if it is not specified in the request body", async () => {

			await GitHubServerApp.install(payload, jiraHost);

			const payLoadWithoutSomeColumns = {
				uuid: uuid,
				appId: 123,
				privateKey: undefined //some specified as with undefined
				//some specified as missing the key ( so undefined as well )
			};

			await GitHubServerApp.updateGitHubAppByUUID(payLoadWithoutSomeColumns, jiraHost);

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
				const app = await GitHubServerApp.install({
					...defaults(uuid)
				}, jiraHost);

				expect(app.privateKey).toBe("encrypted:private-key-plain-text");
				const decryptedPrivateKey = await app.getDecryptedPrivateKey(jiraHost);
				expect(decryptedPrivateKey).toBe("private-key-plain-text");

				expect(app.webhookSecret).toBe("encrypted:webhook-secret-plain-text");
				const decryptedWebhookSecret = await app.getDecryptedWebhookSecret(jiraHost);
				expect(decryptedWebhookSecret).toBe("webhook-secret-plain-text");

				expect(app.gitHubClientSecret).toBe("encrypted:client-secret-plain-text");
				const decryptedGitHubClient = await app.getDecryptedGitHubClientSecret(jiraHost);
				expect(decryptedGitHubClient).toBe("client-secret-plain-text");

			});
		});

		describe("cryptor encryption", () => {

			describe("GitHubServerApp creation", ()=>{
				const INSTALLATION_ID_PK = 100001;
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
					installationId: INSTALLATION_ID_PK
				};
				it("should install new record Successfully without ApiKey", async ()=>{
					const newApp = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD
					}, jiraHost);
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
						installationId: INSTALLATION_ID_PK,
						apiKeyHeaderName: null,
						encryptedApiKeyValue: null
					}));
				});

				it.each(["", undefined, null])("on Install should map %s in ApiKey to null", async (empty)=>{
					const newApp = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						apiKeyHeaderName: empty,
						encryptedApiKeyValue: empty
					}, jiraHost);
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
						installationId: INSTALLATION_ID_PK,
						apiKeyHeaderName: null,
						encryptedApiKeyValue: null
					}));
				});

				it("should install new record Successfully with ApiKey", async ()=>{
					const newApp = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						apiKeyHeaderName: "myApiKeyName",
						encryptedApiKeyValue: "encrypted:myApiKeyValue"
					}, jiraHost);
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
						installationId: INSTALLATION_ID_PK,
						apiKeyHeaderName: "myApiKeyName",
						encryptedApiKeyValue: "encrypted:myApiKeyValue"
					}));
				});

				it("should return existing but NOT override existing record if found", async ()=>{
					const existing = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID1,
						installationId: INSTALLATION_ID_PK
					}, jiraHost);
					const found = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID2, //this indicate even if it is a new uuid, it will override existing
						installationId: INSTALLATION_ID_PK
					}, jiraHost);
					expect(found.id).toBe(existing.id);
					expect(found.uuid).toBe(UUID1);
					expect(found.installationId).toBe(INSTALLATION_ID_PK);
				});
				it("should NOT match existing record if url not match", async ()=>{
					const existing = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID1,
						gitHubBaseUrl: GHES_URL
					}, jiraHost);
					const newApp = await GitHubServerApp.install({
						...DEFAULT_INSTALL_PAYLOAD,
						uuid: UUID2, //need this as the uuid is unique.
						gitHubBaseUrl: ANOTHER_GHES_URL
					}, jiraHost);
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
					gitHubServerApp = await GitHubServerApp.install({
						uuid,
						appId: 1,
						gitHubAppName: "my awesome app",
						gitHubBaseUrl,
						gitHubClientId: originalClientId,
						gitHubClientSecret: "secret",
						webhookSecret: originalWebhookSecret,
						privateKey: originalPrivateKey,
						installationId
					}, jiraHost);
				});

				it("should update GitHub app when uuid is found", async () => {
					const originalApp = await GitHubServerApp.findForUuid(uuid);
					expect(originalApp?.gitHubClientId).toEqual(originalClientId);
					expect(await originalApp?.getDecryptedWebhookSecret(jiraHost)).toEqual(originalWebhookSecret);
					expect(await originalApp?.getDecryptedPrivateKey(jiraHost)).toEqual(originalPrivateKey);

					await GitHubServerApp.updateGitHubAppByUUID({
						uuid,
						appId: 1,
						gitHubAppName: "my awesome app",
						gitHubBaseUrl,
						gitHubClientId: newClientId,
						gitHubClientSecret: "secret",
						webhookSecret: newWebhookSecret,
						privateKey: newPrivateKey,
						installationId,
						apiKeyHeaderName: "newApiKey",
						encryptedApiKeyValue: "encrypted:newApiKeyValue"
					}, jiraHost);

					const updatedApp = await GitHubServerApp.findForUuid(uuid);
					expect(updatedApp?.uuid).toEqual(gitHubServerApp.uuid);
					expect(updatedApp?.gitHubClientId).toEqual(newClientId);
					expect(await updatedApp?.getDecryptedWebhookSecret(jiraHost)).toEqual(newWebhookSecret);
					expect(await updatedApp?.getDecryptedPrivateKey(jiraHost)).toEqual(newPrivateKey);
					expect(await updatedApp?.apiKeyHeaderName).toStrictEqual("newApiKey");
					expect(await updatedApp?.getDecryptedApiKeyValue(jiraHost)).toStrictEqual("newApiKeyValue");
				});

				it("on update should drop apiKey and apiKeyValue when not provided", async () => {
					await GitHubServerApp.updateGitHubAppByUUID({
						uuid,
						appId: 1,
						gitHubAppName: "my awesome updated app",
						gitHubBaseUrl,
						gitHubClientId: newClientId,
						gitHubClientSecret: "secret",
						webhookSecret: newWebhookSecret,
						privateKey: newPrivateKey,
						installationId
					}, jiraHost);

					const updatedApp = (await GitHubServerApp.findForUuid(uuid))!;
					expect(updatedApp.gitHubAppName).toStrictEqual("my awesome updated app");
					expect(updatedApp.apiKeyHeaderName).toStrictEqual(null);
					expect(await updatedApp.getDecryptedApiKeyValue(jiraHost)).toStrictEqual("");
				});

				it.each(["", undefined, null])("on update should map %s in apiKey and apiKeyValue to null", async (empty) => {
					await GitHubServerApp.updateGitHubAppByUUID({
						uuid,
						appId: 1,
						gitHubAppName: "my awesome updated app",
						gitHubBaseUrl,
						gitHubClientId: newClientId,
						gitHubClientSecret: "secret",
						webhookSecret: newWebhookSecret,
						privateKey: newPrivateKey,
						installationId,
						apiKeyHeaderName: empty,
						encryptedApiKeyValue: empty
					}, jiraHost);

					const updatedApp = (await GitHubServerApp.findForUuid(uuid))!;
					expect(updatedApp.gitHubAppName).toStrictEqual("my awesome updated app");
					expect(updatedApp.apiKeyHeaderName).toStrictEqual(null);
					expect(updatedApp.encryptedApiKeyValue).toStrictEqual(null);
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
					}, jiraHost);

					const updatedApp = await GitHubServerApp.findForUuid(mismatchedUUID);
					expect(updatedApp?.uuid).not.toEqual(gitHubServerApp.uuid);
					expect(updatedApp?.gitHubClientId).not.toEqual(newClientId);
					expect(updatedApp?.webhookSecret).not.toEqual(newWebhookSecret);
					expect(await updatedApp?.getDecryptedWebhookSecret(jiraHost)).not.toEqual(newWebhookSecret);
					expect(await updatedApp?.getDecryptedPrivateKey(jiraHost)).not.toEqual(newPrivateKey);
				});

				it("should only update values changed and leave other values as is", async () => {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-expect-error
					await GitHubServerApp.updateGitHubAppByUUID({ uuid, appId: 1, gitHubBaseUrl, webhookSecret: newWebhookSecret });
					const myApp = await GitHubServerApp.findForUuid(uuid);

					expect(myApp?.uuid).toEqual(uuid);
					expect(myApp?.appId).toEqual(gitHubServerApp.appId);
					expect(myApp?.gitHubBaseUrl).toEqual(gitHubServerApp.gitHubBaseUrl);
					expect(await myApp?.getDecryptedWebhookSecret(jiraHost)).toEqual(newWebhookSecret);
					expect(myApp?.gitHubAppName).toEqual(gitHubServerApp.gitHubAppName);
					expect(await myApp?.getDecryptedPrivateKey(jiraHost)).toEqual(originalPrivateKey);
				});
			});
		});
	});

	it("getDecryptedPrivateKey should return decrypted value", async () => {
		await GitHubServerApp.install(payload, jiraHost);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(savedGitHubServerApp!.privateKey).toEqual("encrypted:myprivatekey");
		expect(await savedGitHubServerApp!.getDecryptedPrivateKey(jiraHost)).toEqual("myprivatekey");
	});

	it("getDecryptedGitHubClientSecret should return decrypted value", async () => {
		await GitHubServerApp.install(payload, jiraHost);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(savedGitHubServerApp!.gitHubClientSecret).toEqual("encrypted:myghsecret");
		expect(await savedGitHubServerApp!.getDecryptedGitHubClientSecret(jiraHost)).toEqual("myghsecret");
	});

	it("getDecryptedWebhookSecret should return decrypted value", async () => {
		await GitHubServerApp.install(payload, jiraHost);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(savedGitHubServerApp!.webhookSecret).toEqual("encrypted:mywebhooksecret");
		expect(await savedGitHubServerApp!.getDecryptedWebhookSecret(jiraHost)).toEqual("mywebhooksecret");
	});

	it("getDecryptedApiKeyValue should return decrypted value", async () => {
		await GitHubServerApp.install(payload, jiraHost);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(savedGitHubServerApp!.encryptedApiKeyValue).toEqual("encrypted:api_key");
		expect(await savedGitHubServerApp!.getDecryptedApiKeyValue(jiraHost)).toEqual("api_key");
	});

	it("getDecryptedApiKeyValue should not explode when no apiKeyValue was provided", async () => {
		await GitHubServerApp.install({
			...payload,
			encryptedApiKeyValue: null
		}, jiraHost);
		const savedGitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		expect(await savedGitHubServerApp!.getDecryptedApiKeyValue(jiraHost)).toEqual("");
	});

	describe("encrypt", () => {
		it("should encrypt", async () => {
			expect(await GitHubServerApp.encrypt(jiraHost, "foo")).toStrictEqual("encrypted:foo");
		});
	});

	describe("decrypt", () => {
		it("should decrypt", async () => {
			expect(await GitHubServerApp.decrypt(jiraHost, "encrypted:foo")).toStrictEqual("foo");
		});
	});
});
