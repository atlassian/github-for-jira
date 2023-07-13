import ApiRequest from "../api";

const STATE_KEY = "oauth-localStorage-state";

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

const OauthManager = () => {
	let accessToken: string | undefined;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	let refreshToken: string | undefined;
	let username: string | undefined;
	let email: string | undefined;

	async function checkValidity() {
		if (!accessToken) return;
		const res = await ApiRequest.token.getUserDetails(accessToken);
		username = res.data.login;
		email = res.data.email;

		return res.status === 200;
	}

	async function authenticateInGitHub() {
		const res = await ApiRequest.githubAuth.generateOAuthUrl();
		if (res.data.redirectUrl && res.data.state) {
			window.localStorage.setItem(STATE_KEY, res.data.state);
			window.open(res.data.redirectUrl);
		}
	}

	async function finishOAuthFlow(code: string, state: string) {

		if (!code) return false;
		if (!state) return false;

		const prevState = window.localStorage.getItem(STATE_KEY);
		window.localStorage.removeItem(STATE_KEY);
		if (state !== prevState) return false;

		const token = await ApiRequest.githubAuth.exchangeToken(code, state);
		if (token.data.accessToken) {
			setTokens(token.data.accessToken, token.data.refreshToken);
			return true;
		}

		return false;
	}

	async function installNewApp(onFinish: () => void) {
		const app = await ApiRequest.gitHubApp.getAppNewInstallationUrl();
		const exp = new Date(new Date().getTime() + FIFTEEN_MINUTES_IN_MS);
		document.cookie = `is-spa=true; expires=${exp.toUTCString()}; path=/; SameSite=None; Secure`;
		const winInstall = window.open(app.data.appInstallationUrl, "_blank");
		const hdlWinInstall = setInterval(() => {
			if (winInstall?.closed) {
				try {
					document.cookie = "is-spa=;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=None; Secure";
					onFinish();
				} finally {
					clearInterval(hdlWinInstall);
				}
			}
		}, 1000);
	}

	function setTokens(at: string, rt: string) {
		accessToken = at;
		refreshToken = rt;
	}

	function getUserDetails() {
		return {
			username,
			email
		};
	}

	function clear() {
		accessToken = undefined;
		refreshToken = undefined;
		username = undefined;
		email = undefined;
	}

	return {
		checkValidity,
		authenticateInGitHub,
		finishOAuthFlow,
		getUserDetails,
		clear,
		installNewApp,
	};
};

export default OauthManager;
