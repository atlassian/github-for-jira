import LRUCache from "lru-cache";
import { AuthToken } from "./auth-token";

/**
 * A cache that holds installation tokens for the most recently used installations.
 *
 * An installation token can be used to get data from a GitHub org in which the app has been installed (i.e. get commits, pull requests, etc.).
 *
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation
 */
export class InstallationTokenCache {
	private static instance: InstallationTokenCache;
	private readonly installationTokenCache: LRUCache<string, AuthToken>;

	/**
	 * Creates a new InstallationTokenCache. This cache should be shared between all GitHub clients so that the clients don't
	 * have to re-generate a new installation token for every request they make (which is expensive, because it includes a call to GitHub).
	 * @param maxTokens the max number of tokens that should be in the cache at any time. If the size of the cache is about to go above this
	 * number, the least recently used tokens are evicted from the cache.
	 */
	constructor() {
		this.installationTokenCache = new LRUCache<string, AuthToken>({ max: 1000 });
	}

	public static getInstance(): InstallationTokenCache {
		if (!InstallationTokenCache.instance) {
			InstallationTokenCache.instance = new InstallationTokenCache();
		}
		return InstallationTokenCache.instance;
	}


	/**
	 * Gets the current installation token for the given githubInstallationId. If that token is not in the cache, or if it
	 * is expired, generates a new installation token and stores it in the cache.
	 * @param githubInstallationId the installation whose token to get.
	 * @param generateNewInstallationToken this function must call the GitHub's /app/installations/${githubInstallationId}/access_tokens API
	 * to generate a new installation token. It is only called if the current installation token is expired.
	 */
	public async getInstallationToken(
		githubInstallationId: number,
		gitHubAppId: number | undefined,
		generateNewInstallationToken: () => Promise<AuthToken>): Promise<AuthToken> {
		let token = this.installationTokenCache.get(this.key(githubInstallationId, gitHubAppId));

		if (!token || token.isAboutToExpire()) {
			token = await generateNewInstallationToken();
			this.installationTokenCache.set(this.key(githubInstallationId, gitHubAppId), token, token.millisUntilAboutToExpire());
		}

		return token;
	}

	public clear(): void {
		this.installationTokenCache.reset();
	}

	private key(githubInstallationId: number, gitHubAppId: number | undefined): string {
		return `${githubInstallationId}_${gitHubAppId}`;
	}
}
