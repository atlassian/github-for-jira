import { GitHubAPI } from "probot";
import { getLogger } from "./logger";
import Redis from "ioredis";
import Bottleneck from "bottleneck";
import getRedisInfo from "./redis-info";
import ehanceOctokit from "./enhance-octokit";
import { Options } from "probot/lib/github";
import { isNodeTest } from "../util/isNodeEnv";

// Just create one connection and share it
const redisOptions = getRedisInfo("octokit");
const client = new Redis(redisOptions);
const connection = new Bottleneck.IORedisConnection({ client });

const logger = getLogger("github.api");

export default (options: Partial<GithubAPIOptions> = {}): GitHubAPI => {
	options.logger = options.logger || getLogger("config.github-api");
	options.throttle = {
		enabled: !isNodeTest(),
		onRateLimit: (_, options) => logger.warn({ options }, "Request quota exhausted for request"),
		onAbuseLimit: (_, options) => logger.warn({ options }, "Abuse detected for request")
	};

	// Configure the Bottleneck Redis Client
	options.bottleneck = options.bottleneck || Bottleneck;
	options.connection = options.connection || connection;

	return ehanceOctokit(GitHubAPI(options as Options));
}

interface GithubAPIOptions extends Options {
	connection?: Bottleneck.IORedisConnection;
	bottleneck?: typeof Bottleneck;
}
