const transformPullRequest = require('./transforms/pull-request');
const { getPullRequests: getPullRequestQuery } = require('./queries');
const { logger } = require('probot/lib/logger');

const statsd = require('../config/statsd');

/**
 * @param {import('probot').GitHubAPI} github - The GitHub API Object
 * @param {any} repository - TBD
 * @param {any} cursor - TBD
 * @param {any} perPage - TBD
 * @returns {any} TBD
 */
exports.getPullRequests = async (github, repository, cursor, perPage) => {
  let edges;
  const vars = {
    owner: repository.owner.login,
    repo: repository.name,
    per_page: perPage,
    cursor,
  };

  let asyncTags = [];
  await statsd.asyncTimer(
    async () => {
      try {
        ({ edges } = (await github.graphql(getPullRequestQuery, vars)).repository.pullRequests);
        asyncTags.push('status:200');
      } catch (error) {
        logger.error('GraphQL Query Error for Sync Pull Request', error);
        if (error.status) {
          asyncTags.push(`status:${error.status}`);
        } else if (error.httpError && error.httpError.status) {
          asyncTags.push(`status:${error.httpError.status}`);
        } else {
          asyncTags.push('status:exception');
        }
        throw error;
      }
    },
    'graphql.sync_pull_request',
    1,
    asyncTags,
  )();

  let pullRequests = await Promise.all(edges.map(async ({ node: pull }) => {
    // Count of comments causes graphql to time out, fetch it from the regular API
    const pr = await github.pulls.get({
      owner: repository.owner.login,
      repo: repository.name,
      pull_number: pull.number,
    });
    pull.comments = { totalCount: pr.data.comments };
    const { data } = transformPullRequest({ pull_request: pull, repository }, pull.author);
    return data && data.pullRequests[0];
  }));

  pullRequests = pullRequests.filter(Boolean);

  const jiraPayload = pullRequests.length > 0 && {
    id: repository.id,
    name: repository.full_name,
    pullRequests,
    url: repository.html_url,
    updateSequenceId: Date.now(),
  };
  return { edges, jiraPayload };
};
