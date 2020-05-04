const { GitHubAPI: ProbotGitHubAPI } = require('probot');
const Redis = require('ioredis');
const Bottleneck = require('bottleneck');
const { redisOptions } = require('./redis-info')('octokit');

function GitHubAPI(options = {}) {
  let finalOptions = {};
  if (process.env.NODE_ENV === 'test') {
    finalOptions = {
      // Don't throttle at all
      throttle: {
        enabled: false,
      },
      // Don't retry failures
      request: { retries: 0 },
    };
  }

  // Configure the Bottleneck Redis Client
  if (!options.connection && !options.Bottleneck) {
    const client = new Redis(redisOptions);
    const connection = new Bottleneck.IORedisConnection({ client });
    Object.assign(finalOptions, { connection, Bottleneck });
  }

  Object.assign(finalOptions, options);

  return ProbotGitHubAPI(finalOptions);
}

module.exports = {
  GitHubAPI,
};
