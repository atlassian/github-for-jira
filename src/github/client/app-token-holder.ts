import { AsymmetricAlgorithm, encodeAsymmetric } from "atlassian-jwt";
import { AuthToken, ONE_MINUTE, TEN_MINUTES } from "./auth-token";

//TODO: Remove Probot dependency to find privateKey
import * as PrivateKey from "probot/lib/private-key";
import LRUCache from "lru-cache";
import { InstallationId } from "./installation-id";


export type KeyLocator = (installationId: InstallationId) => string;

/**
 * By default, we just look for a key in the `PRIVATE_KEY` env var.
 */
export const cloudKeyLocator: KeyLocator = () => {
	return PrivateKey.findPrivateKey() || "";
};

/**
 * Holds app tokens for all GitHub apps that are connected and creates new tokens if necessary.
 *
 * An app token allows access to GitHub's /app API only. It does not allow access to a GitHub org's data.
 *
 * @see https://docs.github.com/en/rest/reference/apps
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-a-github-app
 */
export class AppTokenHolder {

	private static instance: AppTokenHolder;
	private readonly privateKeyLocator: KeyLocator;
	private readonly appTokenCache: LRUCache<string, AuthToken>;

	constructor(keyLocator?: KeyLocator) {
		this.appTokenCache = new LRUCache<string, AuthToken>({ max: 1000 });
		this.privateKeyLocator = keyLocator || cloudKeyLocator;
	}

	public static getInstance(): AppTokenHolder {
		if (!AppTokenHolder.instance) {
			AppTokenHolder.instance = new AppTokenHolder();
		}
		return AppTokenHolder.instance;
	}

	/**
	 * Generates a JWT using the private key of the GitHub app to authorize against the GitHub API.
	 */
	private static createAppJwt(key: string, appId: number): AuthToken {

		const expirationDate = new Date(Date.now() + TEN_MINUTES);

		const jwtPayload = {
			// "issued at" date, 60 seconds into the past to allow for some time drift
			iat: Math.floor((Date.now() - ONE_MINUTE) / 1000),
			// expiration date, GitHub allows max 10 minutes
			exp: Math.floor(expirationDate.getTime() / 1000),
			// issuer is the GitHub app ID
			iss: appId.toString()
		};

		return new AuthToken(
			encodeAsymmetric(jwtPayload, key, AsymmetricAlgorithm.RS256),
			expirationDate
		);
	}

	/**
	 * Gets the current app token or creates a new one if the old is about to expire.
	 */
	public getAppToken(appId: InstallationId): AuthToken {
		let currentToken = this.appTokenCache.get(appId.toString());

		if (!currentToken || currentToken.isAboutToExpire()) {
			const key = this.privateKeyLocator(appId);
			currentToken = AppTokenHolder.createAppJwt(key, appId.appId);
			this.appTokenCache.set(appId.toString(), currentToken);
		}
		return currentToken;
	}

	public clear(): void {
		this.appTokenCache.reset();
	}
}
