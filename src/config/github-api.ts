import { GitHubAPI } from "probot";
import { getLogger } from "./logger";
import { Options } from "probot/lib/github";

export const GithubAPI = (options: Partial<Options> = {}): GitHubAPI => {
	options.logger = options.logger || getLogger("config.github-api");
	options.throttle = {
		enabled: false
	};
	return GitHubAPI(options as Options);
};
