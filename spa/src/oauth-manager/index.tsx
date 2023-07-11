import ApiRequest from "../api";

const OauthManager = () => {
	let accessToken: string;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	let refreshToken: string;
	let username: string;
	let email: string;

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

	return {
		checkValidity,
		authenticateInGitHub,
		setTokens,
		getUserDetails,
	};
};

export default OauthManager;
