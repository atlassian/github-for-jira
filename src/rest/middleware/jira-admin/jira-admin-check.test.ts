import { encodeSymmetric } from "atlassian-jwt";
import { Application } from "express";
import supertest from "supertest";
import { Installation } from "models/installation";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { when } from "jest-when";
import { getFrontendApp } from "~/src/app";

jest.mock("config/feature-flags");
jest.mock("models/jira-client");

const testSharedSecret = "test-secret";

describe("Jira Admin Check", () => {

	let app: Application;

	const USER_ACC_ID = "12345";

	beforeEach(async () => {

		when(booleanFlag).calledWith(BooleanFlags.JIRA_ADMIN_CHECK, jiraHost).mockResolvedValue(true);

		app = getFrontendApp();

		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});

	});

	it("should pass request regardless of Jira permissions", async () => {
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
