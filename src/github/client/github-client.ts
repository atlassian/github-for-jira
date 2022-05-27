import Logger from "bunyan";
import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";
import { getLogger } from "~/src/config/logger";

/**
 * A GitHub client superclass
 */
export class GitHubClient {
	protected readonly logger: Logger;
	protected restApiUrl: string;
	protected graphqlUrl: string;

	constructor (
		logger: Logger = getLogger("gitHub-client"),
		baseUrl?: string,
	) {
		this.logger = logger;

		if (baseUrl) {
			this.restApiUrl = `${baseUrl}/api/v3`;
			this.graphqlUrl = `${baseUrl}/api/graphql`;
		} else {
			this.restApiUrl = GITHUB_CLOUD_API_BASEURL;
			this.graphqlUrl = `${GITHUB_CLOUD_API_BASEURL}/graphql`;
		}
	}
}
