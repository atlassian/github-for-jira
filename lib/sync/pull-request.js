const science = require('../config/scientist');
const transformPullRequest = require('./transforms/pull-request');
const {
  getPullRequests: getPullRequestQuery,
  getPullRequestsNoCommentCount,
} = require('./queries');

/**
 * @typedef {object} PRGraphQLArgs
 * @property {string} owner
 * @property {string} repo
 * @property {number} perPage
 * @property {string} cursor
 */

/**
 * The original method fetching all data from GraphQL
 *
 * @param {import('probot').GitHubAPI} github - The GitHub API Object
 * @param {PRGraphQLArgs} vars - The vars for the GraphQL Query
 * @returns {any} TBD
 */
async function queryForPRs(github, vars) {
  const { edges } = (await github.graphql(getPullRequestQuery, vars)).repository.pullRequests;
  return edges;
}

/**
 * Try fetching the comments from the PR API instead of the GraphQL API
 *
 * @param {import('probot').GitHubAPI} github - The GitHub API Object
 * @param {PRGraphQLArgs} vars - The vars for the GraphQL Query
 * @returns {any} TBD
 */
async function queryForPRsExperiment(github, vars) {
  /** @type {{edges: Array<any>}} */
  const { edges } = (await github.graphql(getPullRequestsNoCommentCount, vars)).repository.pullRequests;
  await Promise.all(edges.map(async ({ node: pull }) => {
    const pr = await github.pulls.get({
      owner: vars.owner,
      repo: vars.repo,
      pull_number: pull.number,
    });
    pull.comments = { totalCount: pr.data.comments };
  }));
  return edges;
}

/**
 * @param {import('probot').GitHubAPI} github - The GitHub API Object
 * @param {any} repository - TBD
 * @param {any} cursor - TBD
 * @param {any} perPage - TBD
 * @returns {any} TBD
 */
exports.getPullRequests = async (github, repository, cursor, perPage) => {
  const vars = {
    owner: repository.owner.login,
    repo: repository.name,
    per_page: perPage,
    cursor,
  };
  const edges = await science('pr-graphql-test', (experiment) => {
    experiment.async(true);
    experiment.use(() => queryForPRs(github, vars));
    experiment.try(() => queryForPRsExperiment(github, vars));
  });

  let pullRequests = await Promise.all(edges.map(async ({ node: pull }) => {
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
