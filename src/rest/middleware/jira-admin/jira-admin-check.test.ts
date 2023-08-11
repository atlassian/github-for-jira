import { encodeSymmetric } from "atlassian-jwt";
import express, { Application } from "express";
import supertest from "supertest";
import { Installation } from "models/installation";
import { jiraAdminEnforceMiddleware } from "./jira-admin-check";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import { JiraClient } from "models/jira-client";
import { RestRouter } from "~/src/rest/rest-router";

jest.mock("config/feature-flags");
jest.mock("models/jira-client");

const testSharedSecret = "test-secret";

describe("jwt handler", () => {

	let app: Application;
	let installation: Installation;

	const USER_ACC_ID = "12345";

	beforeEach(async () => {

		when(booleanFlag).calledWith(BooleanFlags.JIRA_ADMIN_CHECK).mockResolvedValue(true);

		app = createApp();

		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});

	});

	it("should fail if is not admin", async () => {

		when(JiraClient.getNewClient).calledWith(installation, expect.anything())
			.mockResolvedValue({
				checkAdminPermissions: jest.fn((userAccountId) => {
					if (userAccountId === USER_ACC_ID) {
						return { data: { globalPermissions: [ "OTHER_ROLE" ] } };
					} else {
						return { data: { globalPermissions: [ "ADMINISTER", "OTHER_ROLE" ] } };
					}
				})
			} as any);

		const token = getToken();
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(200);

	});

	it("should pass request if is admin", async () => {

		when(JiraClient.getNewClient).calledWith(installation, expect.anything())
			.mockResolvedValue({
				checkAdminPermissions: jest.fn((userAccountId) => {
					if (userAccountId === USER_ACC_ID) {
						return { data: { globalPermissions: [ "ADMINISTER", "OTHER_ROLE" ] } };
					} else {
						return { data: { globalPermissions: [ "OTHER_ROLE" ] } };
					}
				})
			} as any);

		const token = getToken();
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(200);

	});

	const createApp = () => {
		const app = express();
		app.use("", jiraAdminEnforceMiddleware);
		RestRouter.get("/test", (_req, res) => {
			res.send(JSON.stringify(res.locals));
		});
		return app;
	};

	const getToken = ({
		secret = testSharedSecret,
		iss = "jira-client-key",
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh" } = {}): any => {
		return encodeSymmetric({
			qsh,
			iss,
			exp
		}, secret);
	};

	const sendRequestWithToken = async (token: string | undefined) => {
		let request = supertest(app).get(`/rest/app/cloud/test`);
		if (token) {
			request = request.set("Authorization", token);
		}
		return await request.send();
	};

});
