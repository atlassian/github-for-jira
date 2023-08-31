import Api from "../../api";
import { popup, reportError } from "../../utils";
import { Result } from "../index";
import { toErrorCode } from "../index";

let username: string | undefined;
let email: string | undefined;

let oauthState: string | undefined;

async function checkValidity(): Promise<Result<void>> {

	if (!Api.token.hasGitHubToken()){
		return {
			success: false,
			errCode: "ERR_GITHUB_TOKEN_EMPTY"
		};
	}

	try {
		const res = await Api.gitHub.getUserDetails();
		username = res.data.login;
		email = res.data.email;

		const success = res.status === 200;

		if (success) {
			return {
				success: true,
				data: undefined
			};
		} else {
			reportError({
				message: "Response status is not 200 for getting user details",
				status: res.status
			});
			return {
				success: false,
				errCode: "ERR_RESP_STATUS_NOT_200"
			};
		}

	} catch (e) {
		reportError(e);
		return {
			success: false,
			errCode: toErrorCode(e)
		};
	}
}

async function authenticateInGitHub(onWinClosed: () => void): Promise<void> {
	const res = await Api.auth.generateOAuthUrl();
	if (res.data.redirectUrl && res.data.state) {
		oauthState = res.data.state;
		const win = popup(res.data.redirectUrl);
		if (win) {
			const winCloseCheckHandler = setInterval(() => {
				if (win.closed) {
					clearInterval(winCloseCheckHandler);
					try { onWinClosed(); } catch (e) { reportError(e); }
				}
			}, 1000);
		}
	} else {
		reportError({ message: "Fail to get redirectUrl and/or state" });
	}
}

async function finishOAuthFlow(code: string, state: string): Promise<Result<void>> {

	if (!code) {
		reportError({ message: "code missing" });
		return { success: false, errCode: "ERR_OAUTH_CODE_EMPTY" };
	}

	if (!state) {
		reportError({ message: "state missing" });
		return { success: false, errCode: "ERR_OAUTH_STATE_EMPTY" };
	}

	const prevState = oauthState;
	oauthState = undefined;

	if (state !== prevState) {
		reportError({ message: "state not match", isPrevStateEmpty: !prevState, isStateEmpty: !state });
		return { success: false, errCode: "ERR_OAUTH_STATE_INVALID" };
	}

	try {
		const token = await Api.auth.exchangeToken(code, state);
		if (token.data.accessToken) {
			Api.token.setGitHubToken(token.data.accessToken);
			return { success: true, data: undefined };
		} else {
			reportError({ message: "fail to acquire accessToken (empty)" });
			return { success: false, errCode: "ERR_OAUTH_TOKEN_ACQUIRE_FAILURE" };
		}
	} catch (e) {
		reportError(e);
		return { success: false, errCode: toErrorCode(e) }
	}
}

function getUserDetails() {
	return {
		username,
		email
	};
}

function clear() {
	Api.token.clearGitHubToken();
	username = undefined;
	email = undefined;
}

export default {
	checkValidity,
	authenticateInGitHub,
	finishOAuthFlow,
	getUserDetails,
	clear
};

