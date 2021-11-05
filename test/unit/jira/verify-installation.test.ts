/* eslint-disable @typescript-eslint/no-explicit-any */
import verifyInstallation from "../../../src/jira/verify-installation";
import {getLogger} from "../../../src/config/logger";
import InstallationClass from "../../../src/models/installation";
import {Installation} from "../../../src/models";
import getAxiosInstance from "../../../src/jira/client/axios";
import {mocked} from "ts-jest/utils";

jest.mock("../../../src/jira/client/axios");

describe("verify-installation", () => {
	let installation: InstallationClass;

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

	afterEach(async () => {
		await installation.destroy();
	})

	test("returns true when Jira responds with 200", async () => {
		mockJiraResponse(200);
		expect(await verifyInstallation(installation, getLogger("test"))()).toBeTruthy();
	});

	test("returns false when Jira responds with 401", async () => {
		mockJiraResponse(401);
		expect(await verifyInstallation(installation, getLogger("test"))()).toBeFalsy();
	});

	test("returns false when Jira client throws an exception", async () => {
		mockJiraResponseException(new Error("boom"));
		expect(await verifyInstallation(installation, getLogger("test"))()).toBeFalsy();
	});
});
