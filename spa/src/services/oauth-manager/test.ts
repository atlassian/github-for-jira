import { when } from "jest-when";
import AuthManager, { __test_only_clearOAuthStates } from "./index";
import Api from "../../api";
import { popup } from "../../utils";

jest.mock("../../api");
jest.mock("../../utils");

describe("AuthManager", () => {
	describe("oauth", () => {

		beforeEach(() => {
			__test_only_clearOAuthStates();
		});

		const REDIRECT_URL = "https://some-redirect-url";
		const mockRedirectUrlOnce = (state: string) => {
			when(Api.auth.generateOAuthUrl)
				.calledWith()
				.mockResolvedValueOnce({ data: { redirectUrl: REDIRECT_URL, state: state } } as any);
		}

		const mockExchangeTokenOnce= (code: string, state: string, accessToken: string) => {
			when(Api.auth.exchangeToken)
				.calledWith(code, state)
				.mockResolvedValueOnce({ data: { accessToken } } as any);
		};

		const onWinCloseAndBlock = { onWinClosed: () => {}, onPopupBlocked: () => {} };

		it("should redirect to oauth url correctly", async () => {

			mockRedirectUrlOnce("some-state");

			await AuthManager.authenticateInGitHub(onWinCloseAndBlock);

			expect(popup).toHaveBeenCalledWith(REDIRECT_URL);

		});

		it("should prevent CSRF attack by providing invalid state", async () => {

			mockExchangeTokenOnce("code123", "some-state", "token123");

			//just try to exchange token without a previous set state
			const result = await AuthManager.finishOAuthFlow("code123", "some-state");

			expect(result).toBe(false);
			expect(Api.token.setGitHubToken).not.toHaveBeenCalled();

		});

		it("should exchange oauth token successfully", async () => {

			mockRedirectUrlOnce("some-state");
			mockExchangeTokenOnce("code123", "some-state", "token123");

			await AuthManager.authenticateInGitHub(onWinCloseAndBlock);

			const result = await AuthManager.finishOAuthFlow("code123", "some-state");
			expect(result).toBe(true);
			expect(Api.token.setGitHubToken).toHaveBeenCalledWith("token123");

		});

		it("should exchange oauth token successfully -- with multi tabs/states", async () => {

			mockRedirectUrlOnce("some-state-1");
			mockRedirectUrlOnce("some-state-2");

			mockExchangeTokenOnce("code123", "some-state-1", "token123");

			await AuthManager.authenticateInGitHub(onWinCloseAndBlock);
			//Open the auth second time to override the first time state
			await AuthManager.authenticateInGitHub(onWinCloseAndBlock);

			//But do the oauth with state from first open tab
			const result = await AuthManager.finishOAuthFlow("code123", "some-state-1");
			expect(result).toBe(true);
			expect(Api.token.setGitHubToken).toHaveBeenCalledWith("token123");

		});

	});
});
