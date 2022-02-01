import { GitHubAPI } from "probot";
import { getLogger } from "./logger";
import enhanceOctokit from "./enhance-octokit";
import { Options } from "probot/lib/github";

export default (options: Partial<Options> = {}): GitHubAPI => {
	options.logger = options.logger || getLogger("config.github-api");
	options.throttle = {
		enabled: false,
	}
	return enhanceOctokit(GitHubAPI(options as Options));
}
