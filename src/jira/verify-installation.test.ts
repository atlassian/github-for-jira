/* eslint-disable @typescript-eslint/no-explicit-any */
import verifyInstallation from "./verify-installation";
import { getLogger } from "config/logger";
import { Installation } from "models/installation";
import getAxiosInstance from "./client/axios";
import { mocked } from "ts-jest/utils";

jest.mock("./client/axios");

describe("verify-installation", () => {
	let installation: Installation;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "client-key"
		});
	});

	function mockJiraResponse(status: number) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		mocked(getAxiosInstance).mockReturnValue({
			"get": () => Promise.resolve<any>({
				status
			})
		});
	}

	function mockJiraResponseException(error: Error) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		mocked(getAxiosInstance).mockReturnValue({
			"get": () => Promise.reject(error)
		});
	}

	it("returns true when Jira responds with 200", async () => {
		mockJiraResponse(200);
		expect(await verifyInstallation(installation, getLogger("test"))()).toBeTruthy();
	});

	it("returns false when Jira responds with 401", async () => {
		mockJiraResponse(401);
		expect(await verifyInstallation(installation, getLogger("test"))()).toBeFalsy();
	});

	it("returns false when Jira client throws an exception", async () => {
		mockJiraResponseException(new Error("boom"));
		expect(await verifyInstallation(installation, getLogger("test"))()).toBeFalsy();
	});
});
