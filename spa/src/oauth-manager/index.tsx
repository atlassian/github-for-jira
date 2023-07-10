import ApiRequest from "../api";
class OauthManager {
	private static accessToken: string | undefined;
	// TODO: remove this comment later
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	private static refreshToken: string | undefined;

	static async checkValidity() {
		if (!this.accessToken) return;
		const res = await ApiRequest.token.checkValidity(this.accessToken);
		return res.status === 200;
	}

	static async authenticateInGitHub() {
		const res = await ApiRequest.githubAuth.authenticate();
		if (res.data.redirectUrl) {
			window.open(res.data.redirectUrl);
		}
	}

	static setTokens(accessToken: string, refreshToken: string) {
		this.accessToken = accessToken;
		this.refreshToken = refreshToken;
	}
}

export default OauthManager;
