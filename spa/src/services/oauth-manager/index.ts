import Api from "../../api";
import { AxiosError } from "axios";
import { popup, reportError } from "../../utils";

let username: string | undefined;
let email: string | undefined;

let oauthStates: string[] = [];

async function checkValidity(): Promise<boolean | AxiosError> {
	if (!Api.token.hasGitHubToken()) return false;

	try {
		const res = await Api.gitHub.getUserDetails();
		username = res.data.login;
		email = res.data.email;

		const ret = res.status === 200;

		if(!ret) {
			reportError({
				message: "Response status is not 200 for getting user details", status: res.status
			}, {
				path: "checkValidity"
			});
		}

		return ret;

	} catch (e: unknown) {
		reportError(new Error("Fail checkValidity", { cause: e }), { path: "checkValidity" });
		return e as AxiosError;
	}
}

async function authenticateInGitHub({
	onWinClosed,
	onPopupBlocked
}: {
	onWinClosed: () => void,
	onPopupBlocked: () => void
}): Promise<void> {
	const res = await Api.auth.generateOAuthUrl();
	if (res.data.redirectUrl && res.data.state) {
		oauthStates.push(res.data.state);
		const win = popup(res.data.redirectUrl);
		if (win === null) {
			onPopupBlocked();
		} else {
			const winCloseCheckHandler = setInterval(() => {
				if (win.closed) {
					clearInterval(winCloseCheckHandler);
					try {
						onWinClosed();
					} catch (e: unknown) {
						reportError(new Error("Fail authenticateInGitHub", { cause: e }), {
							path: "authenticateInGitHub",
							reason: "error in onWinClosed"
						});
					}
				}
			}, 1000);
		}
	} else {
		reportError({
			message: "Empty redirectUrl and/or state"
		}, {
			path: "authenticateInGitHub",
			isRedirectUrlEmpty: !res.data?.redirectUrl,
			isStateEmpty: !res.data.state
		});
	}
}

async function finishOAuthFlow(code: string, state: string): Promise<boolean | AxiosError> {
	if (!code && !state) {
		reportError({
			message: "code or state missing"
		}, {
			path: "finishOAuthFlow",
			isCodeEmpty: !code,
			isStateEmpty: !state
		});
		return false;
	}

	if (!oauthStates.includes(state)) {
		reportError({
			message: "state not match"
		}, {
			path: "finishOAuthFlow",
			oauthStateLength: oauthStates.length,
			isStateEmpty: !state
		});
		return false;
	} else {
		oauthStates.splice(oauthStates.indexOf(state), 1);
	}

	try {
		const token = await Api.auth.exchangeToken(code, state);
		if (token.data.accessToken) {
			Api.token.setGitHubToken(token.data.accessToken);
			return true;
		} else {
			reportError({ message: "fail to acquire accessToken (empty)" }, { path: "finishOAuthFlow", });
			return false;
		}
	} catch (e: unknown) {
		reportError(new Error("Fail exchangeToken", { cause: e }), { path: "finishOAuthFlow" });
		return e as AxiosError;
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

export function __test_only_clearOAuthStates() {
	oauthStates = [];
}

export default {
	checkValidity,
	authenticateInGitHub,
	finishOAuthFlow,
	getUserDetails,
	clear
};


