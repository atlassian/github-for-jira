const { GitHubAPI: ProbotGitHubAPI } = require('probot');

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

  Object.assign(finalOptions, options);

  return ProbotGitHubAPI(finalOptions);
}

module.exports = {
  GitHubAPI,
};
