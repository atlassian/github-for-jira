import Api from "../../api";
import AppManager from "./index";
import { AxiosResponse, AxiosError } from "axios";
import { OrganizationsResponse, ErrorCode } from "rest-interfaces";

jest.mock("../../api");

const successAxioResponse = <T>(data: T) => { return { status: 200, data } as AxiosResponse<T>; };
const failAxioResponse = (status: number, errorCode: ErrorCode): AxiosError => {
	return new AxiosError("error", "blah", undefined, undefined, {
		status: status,
		data: { errorCode }
	} as AxiosResponse);
};

describe("app-manager", () => {
	describe("fetchOrgs", () => {
		it("should return empty orgs when token is empty", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(false);
			const result = await AppManager.fetchOrgs();
			expect(result).toEqual({ orgs: [] });
		});
		it("should return error code as result", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.getOrganizations).mockRejectedValue(failAxioResponse(400, "INVALID_OR_MISSING_ARG"));
			await expect(AppManager.fetchOrgs()).rejects.toThrow(failAxioResponse(400, "INVALID_OR_MISSING_ARG"));
		});
		it("should successfully return orgs", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.getOrganizations).mockResolvedValue(successAxioResponse({
				orgs: [{ id: 123 }]
			} as OrganizationsResponse));
			const result = await AppManager.fetchOrgs();
			expect(result).toEqual({ orgs: [expect.objectContaining({ id: 123 }) ] });
		});
	});
	describe("connecOrg", () => {
		it("should fail on empty github token", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(false);
			try {
				await AppManager.connectOrg(1234);
				expect(true).toBe(false);
			} catch (e) {
				expect(e).toEqual({ errorCode: "INVALID_TOKEN" });
			}
		});
		it("should return error code as result", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.connectOrganization).mockRejectedValue(failAxioResponse(401, "INSUFFICIENT_PERMISSION"));
			try {
				await AppManager.connectOrg(1234);
				expect(true).toBe(false);
			} catch (e) {
				expect(e).toEqual(failAxioResponse(401, "INSUFFICIENT_PERMISSION"));
			}
		});
		it("should successfully connect org", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.connectOrganization).mockResolvedValue(successAxioResponse(undefined));
			const result = await AppManager.connectOrg(1234);
			expect(result).toEqual(undefined);
		});
	});
});
