import { GitHubAPI } from "probot";
import { getLogger } from "./logger";
import Redis from "ioredis";
import Bottleneck from "bottleneck";
import getRedisInfo from "./redis-info";
import ehanceOctokit from "./enhance-octokit";
import { Options } from "probot/lib/github";
import { isTest } from "../util/isEnv";

// Just create one connection and share it
const redisOptions = getRedisInfo("octokit");
const client = new Redis(redisOptions);
const connection = new Bottleneck.IORedisConnection({ client });

export default (options: Partial<GithubAPIOptions> = {}): GitHubAPI => {
	options.logger = options.logger || getLogger("config.github-api");
	if (isTest()) {
		// Don't throttle at all
		options.throttle = {
			enabled: false
		};
	}

	// Configure the Bottleneck Redis Client
	options.bottleneck = options.bottleneck || Bottleneck;
	options.connection = options.connection || connection;

	return ehanceOctokit(GitHubAPI(options as Options));
}

interface GithubAPIOptions extends Options {
	connection?: Bottleneck.IORedisConnection;
	bottleneck?: typeof Bottleneck;
}
