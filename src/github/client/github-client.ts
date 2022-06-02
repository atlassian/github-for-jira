import Logger from "bunyan";
import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";
import { getLogger } from "~/src/config/logger";

/**
 * A GitHub client superclass to encapsulate what differs between our GH clients
 */
export class GitHubClient {
	protected readonly logger: Logger;
	protected restApiUrl: string;
	protected graphqlUrl: string;

	constructor (
		logger: Logger = getLogger("gitHub-client"),
		baseUrl?: string
	) {
		this.logger = logger;

		// baseUrl is undefined when FF is false
		// if FF is true and the githubAppId field is empty, it is set to https://api.github.com
		// TODO - clean this logic up once we remove the GHE_SERVER flag
		if (baseUrl == undefined || baseUrl === "https://api.github.com") {
			this.restApiUrl = GITHUB_CLOUD_API_BASEURL;
			this.graphqlUrl = `${GITHUB_CLOUD_API_BASEURL}/graphql`;
		} else {
			this.restApiUrl = `${baseUrl}/api/v3`;
			this.graphqlUrl = `${baseUrl}/api/graphql`;
		}
	}
}
