/* eslint-disable @typescript-eslint/no-explicit-any */
import { verifyJiraInstallation } from "./verify-installation";
import { getLogger } from "config/logger";
import { Installation } from "models/installation";
import { getAxiosInstance } from "./client/axios";

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
	});

	const mockJiraResponse = (status: number) => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		jest.mocked(getAxiosInstance).mockReturnValue({
			"get": () => Promise.resolve<any>({
				status
			})
		});
	};

	const mockJiraResponseException = (error: Error) => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		jest.mocked(getAxiosInstance).mockReturnValue({
			"get": () => Promise.reject(error)
		});
	};

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

	it("should use new encryptedSharedSecret", async ()=>{
		mockJiraResponse(200);
		await verifyJiraInstallation(installation, getLogger("test"))();
		expect(getAxiosInstance).toHaveBeenCalledWith(expect.anything(), "new-encrypted-shared-secret", expect.anything());
	});
});
