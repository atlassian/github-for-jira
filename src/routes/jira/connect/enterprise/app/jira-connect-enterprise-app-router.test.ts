import { Express } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { v4 as uuid } from "uuid";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";
import { buildQueryTypeJWTToken } from "test/utils/jwt";
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/github-server-app";
import { JiraConnectEnterpriseAppCreateOrEditGet } from "./jira-connect-enterprise-app-create-or-edit-get";

jest.mock("./jira-connect-enterprise-app-create-or-edit-get");

describe("JiraConnectEnterpriseAppRouter", () => {
	const GHE_APP_UUID = uuid();
	const SHARED_SECRET = "abcde";
	let app: Express;
	let installation: Installation;
	beforeEach(async ()=>{
		app = getFrontendApp();
		installation = await Installation.install({
			clientKey: "jira",
			host: jiraHost,
			sharedSecret: SHARED_SECRET
		});
		await GitHubServerApp.install({
			uuid: GHE_APP_UUID,
			appId: 1,
			gitHubAppName: "app1",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "12345",
			gitHubClientSecret: "secret",
			installationId: installation.id,
			privateKey: "private-key",
			webhookSecret: "webhook-secret"
		}, jiraHost);
	});
	describe("Routes with uuid", () => {
		it("should take valid uuid from path and convert to ghe app config", async () => {
			const pathname = `/jira/connect/enterprise/app/${GHE_APP_UUID}`;
			let capturedGHEAppConfig: any;
			jest.mocked(JiraConnectEnterpriseAppCreateOrEditGet).mockImplementationOnce(async (_req, res)=>{
				capturedGHEAppConfig = res.locals.gitHubAppConfig;
				res.status(200).send("ok");
			});
			await supertest(app)
				.get(pathname)
				.set("Cookie", generateSignedSessionCookieHeader({ jiraHost }))
				.set("Authorization", `JWT ${buildQueryTypeJWTToken(SHARED_SECRET, {
					method: "GET",
					pathname
				})}`)
				.expect(200);
			expect(capturedGHEAppConfig).toEqual(expect.objectContaining({
				uuid: GHE_APP_UUID,
				appId: "1"
			}));
		});
		it("should throw error for invalid uuid", async () => {
			const pathname = `/jira/connect/enterprise/app/${uuid()}`;
			await supertest(app)
				.get(pathname)
				.set("Cookie", generateSignedSessionCookieHeader({ jiraHost }))
				.set("Authorization", `JWT ${buildQueryTypeJWTToken(SHARED_SECRET, {
					method: "GET",
					pathname
				})}`)
				.expect(404);
		});
		it("should throw error for uuid belong to other sites", async () => {
			const anotherGheUUID = uuid();
			const installationOfAnotherSite = await Installation.install({
				clientKey: "client-key-2",
				host: "https://some-other-site.atlassian.net",
				sharedSecret: "new-shared-secret"
			});
			await GitHubServerApp.install({
				uuid: anotherGheUUID,
				appId: 1,
				gitHubAppName: "app2",
				gitHubBaseUrl: gheUrl,
				gitHubClientId: "56789",
				gitHubClientSecret: "secret",
				installationId: installationOfAnotherSite.id,
				privateKey: "private-key",
				webhookSecret: "webhook-secret"
			}, jiraHost);

			//try to delete app with uuid for another site
			const pathname = `/jira/connect/enterprise/app/${anotherGheUUID}`;
			await supertest(app)
				.get(pathname)
				.set("Cookie", generateSignedSessionCookieHeader({ jiraHost }))
				.set("Authorization", `JWT ${buildQueryTypeJWTToken(SHARED_SECRET, {
					method: "GET",
					pathname
				})}`)
				.expect(401);
		});
	});
});
