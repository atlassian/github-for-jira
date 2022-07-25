import { GitHubAPI as ProbotGitHubAPI } from "probot";
import { getLogger } from "./logger";
import { Options } from "probot/lib/github";

export const GithubAPI = (options: Partial<Options> = {}): ProbotGitHubAPI => {
	options.logger = options.logger || getLogger("config.github-api");
	options.throttle = {
		enabled: false
	};
	return ProbotGitHubAPI(options as Options);
};
