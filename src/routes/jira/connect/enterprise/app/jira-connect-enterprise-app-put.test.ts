import { Installation } from "models/installation";
import express, { Express } from "express";
import { RootRouter } from "routes/router";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { encodeSymmetric } from "atlassian-jwt";
import { GitHubServerApp } from "models/github-server-app";

describe("PUT /jira/connect/enterprise/app/:uuid", () => {
	let app: Express;
	let installation: Installation;
	let jwt: string;
	const uuid = "4c74e9ce-faf9-489e-821f-e7a8006e473a";

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "jira-client-key"
		});

		app = express();
		app.use(RootRouter);

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: "jira-client-key"
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	});

	it("should return 202 when correct uuid and installation id are passed", async () => {
		await GitHubServerApp.install({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId: installation.id
		}, jiraHost);

		const payload ={
			gitHubAppName: "my-app",
			webhookSecret: `secret`,
			appId: "1",
			gitHubClientId: "Iv1.msdnf2893rwhdbf",
			gitHubClientSecret: "secret",
			uuid,
			gitHubBaseUrl: "http://testserver.com",
			privateKey: "privatekeycontents",
			jiraHost
		};

		await supertest(app)
			.put(`/jira/connect/enterprise/app/${uuid}`)
			.query({
				jwt
			})
			.send(payload)
			.expect(202);

	});

	it("should use existing privateKey if new privateKey is not passed in as body", async () => {

		let existingApp: GitHubServerApp = await GitHubServerApp.install({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId: installation.id
		}, jiraHost);

		const payload ={
			gitHubAppName: "my-app",
			webhookSecret: `secret`,
			appId: "1",
			gitHubClientId: "Iv1.msdnf2893rwhdbf",
			gitHubClientSecret: "secret",
			uuid,
			gitHubBaseUrl: "http://testserver.com",
			//privateKey: "new private key not passed in",
			jiraHost
		};

		await supertest(app)
			.put(`/jira/connect/enterprise/app/${uuid}`)
			.query({
				jwt
			})
			.send(payload)
			.expect(202);

		existingApp =(await GitHubServerApp.findByPk(existingApp.id))!;

		expect(await existingApp?.getDecryptedPrivateKey(jiraHost)).toBe("privatekey");
	});

	it("should return 202 when correct uuid and installation id are passed, with partial data", async () => {
		await GitHubServerApp.install({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId: installation.id
		}, jiraHost);

		const payload ={
			gitHubAppName: "newName",
			webhookSecret: "newSecret",
			gitHubClientId: "Iv1.msdnf2893rwhdbf",
			gitHubClientSecret: "secret",
			uuid,
			jiraHost
		};

		await supertest(app)
			.put(`/jira/connect/enterprise/app/${uuid}`)
			.query({
				jwt
			})
			.send(payload)
			.expect(202);

		const restoredApp = (await GitHubServerApp.findForUuid(uuid))!;

		expect(restoredApp.gitHubAppName).toEqual("newName");
		expect(await restoredApp.getDecryptedWebhookSecret(jiraHost)).toEqual("newSecret");
		expect(await restoredApp.getDecryptedPrivateKey(jiraHost)).toEqual("privatekey");
		expect(await restoredApp.getDecryptedGitHubClientSecret(jiraHost)).toEqual("secret");
	});

	it("should return 404 when wrong uuid param is passed", async () => {
		await GitHubServerApp.install({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId: installation.id
		}, jiraHost);

		const payload ={
			gitHubAppName: "my-app",
			webhookSecret: "secret",
			appId: "1",
			gitHubClientId: "Iv1.msdnf2893rwhdbf",
			gitHubClientSecret: "secret",
			uuid,
			gitHubBaseUrl: "http://testserver.com",
			privateKey: "privatekeycontents",
			jiraHost
		};

		const incorrectUUID = "4c74e9ce-faf9-489e-821f-e7a8006e473b";

		const res = await supertest(app)
			.put(`/jira/connect/enterprise/app/${incorrectUUID}`)
			.query({
				jwt
			})
			.send(payload)
			.expect(404);
		expect(res.body).toEqual({ message: "No GitHub app found for provided id." });

	});

	it("should return 404 when wrong installationId is passed", async () => {
		await GitHubServerApp.install({
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret",
			webhookSecret: "anothersecret",
			privateKey: "privatekey",
			installationId: 42
		}, jiraHost);

		const payload ={
			gitHubAppName: "my-app",
			webhookSecret: "secret",
			appId: "1",
			gitHubClientId: "Iv1.msdnf2893rwhdbf",
			gitHubClientSecret: "secret",
			uuid,
			gitHubBaseUrl: "http://testserver.com",
			privateKey: "privatekeycontents",
			jiraHost
		};

		const res = await supertest(app)
			.put(`/jira/connect/enterprise/app/${uuid}`)
			.query({
				jwt
			})
			.send(payload)
			.expect(401);
		expect(res.body).toEqual({ message: "Jira hosts do not match." });
	});
});
