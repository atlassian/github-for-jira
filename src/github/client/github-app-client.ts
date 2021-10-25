import { Octokit } from "@octokit/rest";
import { AsymmetricAlgorithm, encodeAsymmetric } from "atlassian-jwt";
import HttpClient, { AuthToken, ONE_MINUTE, TEN_MINUTES } from "./http-client";
import { AxiosInstance, AxiosRequestConfig } from "axios";

type Context = {
	now: () => Date;
	authToken: AuthToken;
	key: string;
	appId: string;
}

/**
 * Client that interacts with GitHubs "/app" API. Uses a JWT generated from the GitHub app's private key to authorize.
 *
 * @see https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps
 */
export default class GithubAppClient extends HttpClient<Context> {
	protected readonly axios: AxiosInstance;

	/**
	 * @param key the private key of the GitHub app, used to generate JWT tokens.
	 * @param appId ID of the GitHub app, needed to generate JWT tokens.
	 * @param baseURL optional base URL to the GitHub API. Defaults to "https://api.github.com".
	 * @param now optional function to inject the current date for testing. Defaults to the current date.
	 */
	constructor(
		key: string,
		appId: string,
		baseURL = "https://api.github.com",
		now: () => Date = () => new Date()
	) {
		super(baseURL, {
			now,
			authToken: GithubAppClient.createAppJwt(key, appId, now),
			key,
			appId
		});
	}

	/**
	 * Intercepts requests to add the Authorization header, refreshing the token as needed.
	 */
	protected onRequest(context: Context): (config: AxiosRequestConfig) => Promise<AxiosRequestConfig> {
		return async (config: AxiosRequestConfig): Promise<AxiosRequestConfig> => {

			// refresh token, if needed
			if (!context.authToken || context.authToken.isAboutToExpire(context.now())) {
				context.authToken = GithubAppClient.createAppJwt(context.key, context.appId, context.now);
			}

			config.headers.Accept = "application/vnd.github.v3+json";
			config.headers.Authorization = `Bearer ${context.authToken.token}`;

			return config;
		}
	}

	/**
	 * Generates a JWT using the private key of the GitHub app to authorize against the GitHub API.
	 */
	private static createAppJwt(key: string, appId: string, now: () => Date): AuthToken {

		const expirationDate = new Date(now().getTime() + TEN_MINUTES);

		const jwtPayload = {
			// "issued at" date, 60 seconds into the past to allow for some time drift
			iat: Math.floor((now().getTime() - ONE_MINUTE) / 1000),
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

	/**
	 * Calls the GitHub API in the name of the GitHub app to generate a token that in turn can be used to call the GitHub
	 * API in the name of an installation of that app (to access the users' data).
	 */
	public async createInstallationToken(githubInstallationId: number): Promise<AuthToken> {
		const response = await this.axios.post<Octokit.AppsCreateInstallationTokenResponse>(`/app/installations/${githubInstallationId}/access_tokens`);
		const tokenResponse: Octokit.AppsCreateInstallationTokenResponse = response.data;
		return new AuthToken(tokenResponse.token, new Date(tokenResponse.expires_at));
	}

}
