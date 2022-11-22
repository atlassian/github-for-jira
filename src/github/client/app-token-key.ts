import { envVars }  from "config/env";
import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";
/**
 * An installation ID uniquely identifies an installation of a GitHub app across the (single) cloud instance
 * and (potentially many) GHE instances.
 */
export class AppTokenKey {
	readonly githubBaseUrl: string;
	readonly appId: number;

	/**
	 * @param githubBaseUrl the base URL of the API of the GitHub server we want to connect with (cloud or on-premise).
	 * @param appId the numeric ID of the GitHub app on that server that we want to connect with.
	 * @param installationId the numeric ID of the installation of that app in whose name we want to make calls to
	 * the GitHub API.
	 */
	constructor(githubBaseUrl: string, appId: number) {
		this.githubBaseUrl = githubBaseUrl;
		this.appId = appId;
	}

	static fromString(appIdString: string): AppTokenKey {
		const regex = /^(.+)###([0-9]+)###$/;
		const matches = regex.exec(appIdString);

		if (matches == null || matches.length < 3) {
			throw new Error(`could not extract AppId from string: ${appIdString}`);
		}

		const githubUrl = matches[1];
		const appId = matches[2];
		return new AppTokenKey(githubUrl, parseInt(appId));
	}

	toString(): string {
		return `${this.githubBaseUrl}###${this.appId}###`;
	}
}

export const getAppTokenKey = (gitHubApiBaseUrl?: string | undefined, appId?: number): AppTokenKey => {
	const baseUrl = gitHubApiBaseUrl ? gitHubApiBaseUrl : GITHUB_CLOUD_API_BASEURL;
	const applicationId = appId ? appId: parseInt(envVars.APP_ID);
	return new AppTokenKey(baseUrl, applicationId);
};
