import AppManagaer from "./index";
import Api from "../../api";
import { mockAxiosError, mockAxiosResponse } from "../../test-utils";

jest.mock("../../api");

describe("App Manager", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});
	describe("fetchOrgs", () => {
		it("should return success but emptpy orgs when github token is empty", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(false);
			const result = await AppManagaer.fetchOrgs();
			expect(result).toEqual({
				success: true,
				data: { orgs: [] }
			});
		});
		it("should return axios error code if throw axios error", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.getOrganizations).mockRejectedValue(mockAxiosError("INSUFFICIENT_PERMISSION"));
			const result = await AppManagaer.fetchOrgs();
			expect(result).toEqual({
				success: false,
				errCode: "INSUFFICIENT_PERMISSION"
			});
		});
		it("should return orgs array successfully", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.getOrganizations).mockResolvedValue(mockAxiosResponse(200, {
				orgs: [{ id: 1 } as any, { id: 2 } as any]
			}));
			const result = await AppManagaer.fetchOrgs();
			expect(result).toEqual({
				success: true,
				data: {
					orgs: [{
						id: 1
					}, {
						id: 2
					}]
				}
			});
		});
	});
	describe("connectOrg", () => {
		it("should return success:false when github token is empty", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(false);
			const result = await AppManagaer.connectOrg(1234);
			expect(result).toEqual({
				success: false,
				errCode: "ERR_GITHUB_TOKEN_EMPTY"
			});
		});
		it("should return axios error code if throw axios error", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.connectOrganization).mockRejectedValue(mockAxiosError("INSUFFICIENT_PERMISSION"));
			const result = await AppManagaer.connectOrg(1234);
			expect(result).toEqual({
				success: false,
				errCode: "INSUFFICIENT_PERMISSION"
			});
		});
		it("should throw status not match error if status not 200", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.connectOrganization).mockResolvedValue(mockAxiosResponse(201, {}));
			const result = await AppManagaer.connectOrg(1234);
			expect(result).toEqual({
				success: false,
				errCode: "ERR_RESP_STATUS_NOT_200"
			});
		});
		it("should connect orgs array successfully", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.orgs.connectOrganization).mockImplementation(async (orgId) => {
				if (orgId === 1234) return mockAxiosResponse(200, undefined);
				throw mockAxiosError("UNKNOWN");
			});
			const result = await AppManagaer.connectOrg(1234);
			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});
	});
	describe("installNewApp", () => {
		it("should return success:false when generating app url fail", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.app.getAppNewInstallationUrl).mockRejectedValue(mockAxiosError("INSUFFICIENT_PERMISSION"));
			const result = await AppManagaer.installNewApp({ onFinish: jest.fn(), onRequested: jest.fn() });
			expect(result).toEqual({
				success: false,
				errCode: "INSUFFICIENT_PERMISSION"
			});
		});
	});
});
