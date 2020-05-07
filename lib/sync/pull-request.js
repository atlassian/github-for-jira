const transformPullRequest = require('./transforms/pull-request');
const { getPullRequests: getPullRequestQuery } = require('./queries');

/**
 * @param {import('probot').GitHubAPI} github - The GitHub API Object
 * @param {any} repository - TBD
 * @param {any} cursor - TBD
 * @param {any} perPage - TBD
 * @returns {any} TBD
 */
exports.getPullRequests = async (github, repository, cursor, perPage) => {
  const { edges } = (await github.graphql(getPullRequestQuery, {
    owner: repository.owner.login,
    repo: repository.name,
    per_page: perPage,
    cursor,
  })).repository.pullRequests;

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
