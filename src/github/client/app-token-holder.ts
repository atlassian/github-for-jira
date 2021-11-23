import { AsymmetricAlgorithm, encodeAsymmetric } from "atlassian-jwt";
import AuthToken, { ONE_MINUTE, TEN_MINUTES } from "./auth-token";

//TODO: Remove Probot dependency to find privateKey
import * as PrivateKey from "probot/lib/private-key";
import envVars from "../../config/env";

/**
 * Holds the GitHub app's token to authenticate as a GitHub app and refreshes it as needed.
 *
 * An app token allows access to GitHub's /app API only. It does not allow access to a GitHub org's data.
 *
 * @see https://docs.github.com/en/rest/reference/apps
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-a-github-app
 */
export default class AppTokenHolder {

	private readonly key: string;
	private readonly appId: string;
	private currentToken: AuthToken;

	private static instance: AppTokenHolder;

	constructor() {
		this.key = PrivateKey.findPrivateKey() || "";
		this.appId = envVars.APP_ID;
	}

	public static getInstance(): AppTokenHolder {
		if (!AppTokenHolder.instance) {
			AppTokenHolder.instance = new AppTokenHolder();
		}
		return AppTokenHolder.instance;
	}


	/**
	 * Gets the current app token or creates a new one if the old is about to expire.
	 */
	public getAppToken(): AuthToken {
		if (!this.currentToken || this.currentToken.isAboutToExpire()) {
			this.currentToken = AppTokenHolder.createAppJwt(this.key, this.appId);
		}
		return this.currentToken;
	}

	/**
	 * Generates a JWT using the private key of the GitHub app to authorize against the GitHub API.
	 */
	private static createAppJwt(key: string, appId: string): AuthToken {

		const expirationDate = new Date(Date.now() + TEN_MINUTES);

		const jwtPayload = {
			// "issued at" date, 60 seconds into the past to allow for some time drift
			iat: Math.floor((Date.now() - ONE_MINUTE) / 1000),
			// expiration date, GitHub allows max 10 minutes
			exp: Math.floor(expirationDate.getTime() / 1000),
			// issuer is the GitHub app ID
			iss: appId
		}

		return new AuthToken(
			encodeAsymmetric(jwtPayload, key, AsymmetricAlgorithm.RS256),
			expirationDate
		);
	}
}
