import OAuthManager from "./index";

describe("OAuthManager", () => {
	describe("checkValidity", () => {
		it("should return TOKEN_EMPTY_ERROR if github token is empty", async () => {
			const result = await OAuthManager.checkValidity();
			expect(result).toEqual({
				success: false,
				errorCode: "ERR_GITHUB_TOKEN_EMPTY"
			});
		});
	});
});
