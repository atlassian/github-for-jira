import Api from "../../api";
import { AxiosError } from "axios";
import { popup, reportError } from "../../utils";

let username: string | undefined;
let email: string | undefined;

let oauthState: string | undefined;

async function checkValidity(): Promise<boolean | AxiosError> {
	if (!Api.token.hasGitHubToken()) return false;

	try {
		const res = await Api.gitHub.getUserDetails();
		username = res.data.login;
		email = res.data.email;

		return res.status === 200;
	} catch (e) {
		reportError(e);
		return e as AxiosError;
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
	}
}

async function finishOAuthFlow(code: string, state: string): Promise<boolean | AxiosError> {

	if (!code && !state) return false;

	const prevState = oauthState;
	oauthState = undefined;

	if (state !== prevState) return false;

	try {
		const token = await Api.auth.exchangeToken(code, state);
		if (token.data.accessToken) {
			Api.token.setGitHubToken(token.data.accessToken);
			return true;
		} else {
			return false;
		}
	} catch (e) {
		reportError(e);
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

export default {
	checkValidity,
	authenticateInGitHub,
	finishOAuthFlow,
	getUserDetails,
	clear
};

