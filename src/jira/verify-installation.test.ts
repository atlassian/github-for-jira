/* eslint-disable @typescript-eslint/no-explicit-any */
import { verifyJiraInstallation } from "./verify-installation";
import { getLogger } from "config/logger";
import { Installation } from "models/installation";
import { getAxiosInstance } from "./client/axios";
import { BooleanFlags, booleanFlag } from "config/feature-flags";
import { when } from "jest-when";

jest.mock("./client/axios");
jest.mock("config/feature-flags");

describe("verify-installation", () => {
	let installation: Installation;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "new-encrypted-shared-secret",
			clientKey: "client-key"
		});
		//doing bellow so that the sharedSecret is "shared-secret",
		//while the encryptedSharedSecret will be "new-encrypted-shared-secret"
		//so that we can test the FF
		installation.sharedSecret = "shared-secret";
	});

	function mockJiraResponse(status: number) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		jest.mocked(getAxiosInstance).mockReturnValue({
			"get": () => Promise.resolve<any>({
				status
			})
		});
	}

	function mockJiraResponseException(error: Error) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		jest.mocked(getAxiosInstance).mockReturnValue({
			"get": () => Promise.reject(error)
		});
	}

	it("returns true when Jira responds with 200", async () => {
		mockJiraResponse(200);
		expect(await verifyJiraInstallation(installation, getLogger("test"))()).toBeTruthy();
	});

	it("returns false when Jira responds with 401", async () => {
		mockJiraResponse(401);
		expect(await verifyJiraInstallation(installation, getLogger("test"))()).toBeFalsy();
	});

	it("returns false when Jira client throws an exception", async () => {
		mockJiraResponseException(new Error("boom"));
		expect(await verifyJiraInstallation(installation, getLogger("test"))()).toBeFalsy();
	});

	it("should use existing sharedSecret when read from cryptor FF is Off", async ()=>{
		when(jest.mocked(booleanFlag))
			.calledWith(BooleanFlags.READ_SHARED_SECRET_FROM_CRYPTOR, expect.anything(), expect.anything())
			.mockResolvedValueOnce(false);
		mockJiraResponse(200);
		await verifyJiraInstallation(installation, getLogger("test"))();
		expect(getAxiosInstance).toHaveBeenCalledWith(expect.anything(), "shared-secret", expect.anything());
	});

	it("should use new encryptedSharedSecret when read from cryptor FF is ON", async ()=>{
		when(jest.mocked(booleanFlag))
			.calledWith(BooleanFlags.READ_SHARED_SECRET_FROM_CRYPTOR, expect.anything(), expect.anything())
			.mockResolvedValueOnce(true);
		mockJiraResponse(200);
		await verifyJiraInstallation(installation, getLogger("test"))();
		expect(getAxiosInstance).toHaveBeenCalledWith(expect.anything(), "new-encrypted-shared-secret", expect.anything());
	});
});
