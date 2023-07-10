import ApiRequest from "../api";

class OauthManager {
	private accessToken: string | undefined;
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private refreshToken: string | undefined;

	async checkValidity() {
		if (!this.accessToken) return;
		const res = await ApiRequest.token.checkValidity(this.accessToken);
		return res.status === 200;
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
