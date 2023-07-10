import ApiRequest from "../api";

class OauthManager {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private accessToken: string | undefined;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private refreshToken: string | undefined;

	checkValidity() {
		// TODO: API call to check the validity for the tokens in this class
	}

	async authenticateInGitHub() {
		const res = await ApiRequest.githubAuth.authenticate();
		if (res.data.redirectUrl) {
			window.open(res.data.redirectUrl);
		}
	}

	setTokens(accessToken: string, refreshToken: string) {
		this.accessToken = accessToken;
		this.refreshToken = refreshToken;
	}
}

export default OauthManager;
