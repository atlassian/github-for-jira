import OAuthManager from "./index";
import Api from "../../api";
import { mockAxiosError, mockAxiosResponse } from "../../test-utils";

jest.mock("../../api");

describe("OAuthManager", () => {
	describe("checkValidity", () => {
		it("should return ERR_GITHUB_TOKEN_EMPTY if github token is empty", async () => {
			const result = await OAuthManager.checkValidity();
			expect(result).toEqual({
				success: false,
				errCode: "ERR_GITHUB_TOKEN_EMPTY"
			});
		});
		it("should return ERR_RESP_STATUS_NOT_200 if status not match", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.gitHub.getUserDetails).mockResolvedValue({
				status: 201,
				data: {}
			} as any);
			const result = await OAuthManager.checkValidity();
			expect(result).toEqual({
				success: false,
				errCode: "ERR_RESP_STATUS_NOT_200"
			});
		});
		it("should return axios error code if throw axios error", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.gitHub.getUserDetails).mockRejectedValue(mockAxiosError("INSUFFICIENT_PERMISSION"));
			const result = await OAuthManager.checkValidity();
			expect(result).toEqual({
				success: false,
				errCode: "INSUFFICIENT_PERMISSION"
			});
		});
		it("should return empty data successfully", async () => {
			jest.mocked(Api.token.hasGitHubToken).mockReturnValue(true);
			jest.mocked(Api.gitHub.getUserDetails).mockResolvedValue(mockAxiosResponse(200, {
				login: "login value",
				email: "blah@blah.blah"
			}));
			const result = await OAuthManager.checkValidity();
			expect(result).toEqual({
				success: true,
				data: undefined
			});
		});
	});
	describe("finish oauth flow", () => {
		it("should return error when code is empty", async () => {
			expect(await OAuthManager.finishOAuthFlow("", "some-state")).toEqual({
				success: false,
				errCode: "ERR_OAUTH_CODE_EMPTY"
			});
		});
	});
});
