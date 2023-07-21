import Api from "../../api";

const STATE_KEY = "oauth-localStorage-state";

let username: string | undefined;
let email: string | undefined;

async function checkValidity(): Promise<boolean> {

	if (!Api.token.hasGitHubToken()) return false;

	try {
		const res = await Api.gitHub.getUserDetails();
		username = res.data.login;
		email = res.data.email;

		return res.status === 200;
	}catch (e) {
		console.error(e, "Failed to check validity");
		return false;
	}
}

async function authenticateInGitHub(): Promise<void> {
	const res = await Api.auth.generateOAuthUrl();
	if (res.data.redirectUrl && res.data.state) {
		window.localStorage.setItem(STATE_KEY, res.data.state);
		window.open(res.data.redirectUrl);
	}
}

async function finishOAuthFlow(code: string, state: string): Promise<boolean> {

	if (!code) return false;
	if (!state) return false;

	const prevState = window.localStorage.getItem(STATE_KEY);
	window.localStorage.removeItem(STATE_KEY);
	if (state !== prevState) return false;

	const token = await Api.auth.exchangeToken(code, state);
	if (token.data.accessToken) {
		Api.token.setGitHubToken(token.data.accessToken);
		return true;
	}

	return false;
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
	clear,
};

