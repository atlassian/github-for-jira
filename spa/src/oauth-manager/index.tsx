import ApiRequest from "../api";

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
		const res = await ApiRequest.githubAuth.authenticate();
		if (res.data.redirectUrl) {
			window.open(res.data.redirectUrl);
		}
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
		setTokens,
		getUserDetails,
		clear,
	};
};

export default OauthManager;
