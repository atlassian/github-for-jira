import AppManagaer from "./index";
import Api from "../../api";
import { mockAxiosError, mockAxiosResponse } from "../../test-utils";

jest.mock("../../api");

describe("App Manager", () => {
	describe("fetchOrgs", () => {
		it("should return success but emptpy orgs when github token is empty", async () => {
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
});
