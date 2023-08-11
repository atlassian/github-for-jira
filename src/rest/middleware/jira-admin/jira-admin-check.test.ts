import { encodeSymmetric } from "atlassian-jwt";
import { Application } from "express";
import supertest from "supertest";
import { Installation } from "models/installation";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import { JiraClient } from "models/jira-client";
import { getFrontendApp } from "~/src/app";

jest.mock("config/feature-flags");
jest.mock("models/jira-client");

const testSharedSecret = "test-secret";

describe("Jira Admin Check", () => {

	let app: Application;
	let installation: Installation;

	const USER_ACC_ID = "12345";

	beforeEach(async () => {

		when(booleanFlag).calledWith(BooleanFlags.JIRA_ADMIN_CHECK, jiraHost).mockResolvedValue(true);

		app = getFrontendApp();

		installation = await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});

	});

	const mockPermission = (permissions: string[]) => {
		when(JiraClient.getNewClient).calledWith(expect.anything(), expect.anything())
			.mockImplementation((reqInst: Installation) => {
				if (reqInst.id === installation.id) {
					return {
						checkAdminPermissions: jest.fn((userAccountId) => {
							if (userAccountId === USER_ACC_ID) {
								return { data: { globalPermissions: permissions } };
							} else {
								return { data: { globalPermissions: ["ADMINISTER", "OTHER_ROLE"] } };
							}
						})
					} as any;
				} else {
					throw new Error("Wrong installation " + reqInst);
				}
			});

	};

	it("should fail if is not admin", async () => {

		mockPermission([ "OTHER_ROLE" ]);

		const res = await sendRequestWithToken();

		expect(res.status).toEqual(401);
		expect(JSON.parse(res.text)).toEqual(expect.objectContaining({
			errorCode: "INSUFFICIENT_PERMISSION",
			message: expect.stringContaining("Forbidden")
		}));

	});

	it("should pass request if is admin", async () => {

		mockPermission([ "ADMINISTER", "OTHER_ROLE" ]);

		const res = await sendRequestWithToken();

		expect(res.status).toEqual(200);
		expect(JSON.parse(res.text)).toEqual({
			redirectUrl: expect.stringContaining("oauth/authorize"),
			state: expect.anything()
		});

	});

	const sendRequestWithToken = async () => {
		return await supertest(app)
			.get(`/rest/app/cloud/oauth/redirectUrl`)
			.set("Authorization", getToken())
			.send();
	};

	const getToken = ({
		secret = testSharedSecret,
		iss = "jira-client-key",
		sub = USER_ACC_ID,
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh" } = {}): any => {
		return encodeSymmetric({
			qsh,
			iss,
			sub,
			exp
		}, secret);
	};

});
