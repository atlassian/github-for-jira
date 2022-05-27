import Logger from "bunyan";
import {GITHUB_CLOUD_API_BASEURL} from "utils/get-github-client-config";
import { getLogger } from "~/src/config/logger";

/**
 * A GitHub client superclass
 */
export class GitHubClient {
	protected readonly logger: Logger;
	protected readonly baseUrl: string;

	constructor (logger: Logger  = getLogger("gitHub-client"), baseUrl = GITHUB_CLOUD_API_BASEURL) {
		this.logger = logger;
		this.baseUrl = baseUrl;
	}
}
