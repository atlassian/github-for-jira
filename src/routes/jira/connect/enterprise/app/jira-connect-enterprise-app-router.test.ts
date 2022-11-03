import { Express } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { v4 as uuid } from "uuid";
import { getSignedCookieHeader } from "test/utils/cookies";
import { buildQueryTypeJWTToken } from "test/utils/jwt";
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/github-server-app";
import { JiraConnectEnterpriseAppCreateOrEdit } from "./jira-connect-enterprise-app-create-or-edit";

jest.mock("./jira-connect-enterprise-app-create-or-edit");

describe("JiraConnectEnterpriseAppRouter", () => {
	const GHE_APP_UUID = uuid();
	const SHARED_SECRET = "abcde";
	let app: Express;
	let installation: Installation;
	beforeEach(async ()=>{
		app = getFrontendApp();
		installation = await Installation.install({
			clientKey: "client-key-1",
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
		});
	});
	describe("Routes with uuid", () => {
		it("should take valid uuid from path and convert to ghe app config", async () => {
			const pathname = `/jira/connect/enterprise/app/${GHE_APP_UUID}`;
			let capturedGHEAppConfig: any;
			jest.mocked(JiraConnectEnterpriseAppCreateOrEdit).mockImplementationOnce(async (_req, res)=>{
				capturedGHEAppConfig = res.locals.gitHubAppConfig;
				res.status(200).send("ok");
			});
			await supertest(app)
				.get(pathname)
				.set("Cookie", getSignedCookieHeader({ jiraHost }))
				.set("Authorization", `JWT ${buildQueryTypeJWTToken(SHARED_SECRET, {
					method: "GET",
					pathname
				})}`)
				.expect(200);
			expect(capturedGHEAppConfig).toBe({});
		});
	});
});
