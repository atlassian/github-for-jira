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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		when(JiraClient.getNewClient).calledWith(expect.anything(), expect.anything())
			.mockImplementation((reqInst: Installation): Promise<JiraClient> => {
				if (reqInst.id === installation.id) {
					return Promise.resolve({
						checkAdminPermissions: jest.fn((userAccountId) => {
							if (userAccountId === USER_ACC_ID) {
								return { data: { globalPermissions: permissions } };
							} else {
								return { data: { globalPermissions: ["ADMINISTER", "OTHER_ROLE"] } };
							}
						})
					}) as unknown as Promise<JiraClient>;
				} else {
					throw new Error(`Wrong installation ${reqInst.toString()}`);
				}
			});

	};

	it("should fail if is not admin", async () => {

		mockPermission([ "OTHER_ROLE" ]);

		const res = await sendRequestWithToken();

		expect(res.status).toEqual(401);
		expect(JSON.parse(res.text)).toEqual(expect.objectContaining({
			errorCode: "INSUFFICIENT_PERMISSION",
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			message: expect.stringContaining("Forbidden")
		}));

	});

	it("should pass request if is admin", async () => {

		mockPermission([ "ADMINISTER", "OTHER_ROLE" ]);

		const res = await sendRequestWithToken();

		expect(res.status).toEqual(200);
		expect(JSON.parse(res.text)).toEqual({
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			redirectUrl: expect.stringContaining("oauth/authorize"),
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
		qsh = "context-qsh" } = {}) => {
		return encodeSymmetric({
			qsh,
			iss,
			sub,
			exp
		}, secret);
	};

});
