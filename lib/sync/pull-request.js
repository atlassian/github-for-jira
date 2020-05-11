const url = require('url');
const transformPullRequest = require('./transforms/pull-request');
const statsd = require('../config/statsd');

/**
 * @typedef {object} RepositoryObject
 * @property {number} id
 * @property {string} name
 * @property {object} owner
 * @property {string} owner.login
 * @property {string} html_url
 * @property {string} full_name
 */

/**
 * Find the next page number from the response headers.
 *
 * @param {{link: string}} headers - The headers from the API response.
 * @returns {number|undefined} The next page number.
 */
function getNextPage(headers = {}) {
  const nextUrl = ((headers.link || '').match(/<([^>]+)>;\s*rel="next"/) || [])[1];
  if (!nextUrl) {
    return;
  }
  const parsed = url.parse(nextUrl).query.split('&');
  let nextPage;
  parsed.forEach((query) => {
    const [key, value] = query.split('=');
    if (key === 'page') {
      nextPage = Number(value);
    }
  });
  return nextPage;
}

/**
 * @param {import('probot').GitHubAPI} github - The GitHub API Object
 * @param {RepositoryObject} repository - TBD
 * @param {string|number} cursor - TBD
 * @param {any} perPage - TBD
 * @returns {any} TBD
 */
async function getPullRequests(github, repository, cursor, perPage) {
  /** @type {number} */
  let status;
  /** @type {{link: string}} */
  let headers;
  /** @type {import('@octokit/rest').Octokit.PullsListResponse} */
  let edges;
  if (!cursor) {
    cursor = 1;
  } else {
    cursor = Number(cursor);
  }
  const vars = {
    owner: repository.owner.login,
    repo: repository.name,
    per_page: perPage,
    page: cursor,
  };

  let asyncTags = [];
  await statsd.asyncTimer(
    async () => {
      ({ data: edges, status, headers } = (await github.pulls.list({
        ...vars,
        state: 'all',
        sort: 'created',
        direction: 'desc',
      })));
      asyncTags.push(`status:${status}`);
    },
    'rest.sync_pull_request',
    1,
    asyncTags,
  )();

  const nextPage = getNextPage(headers);

  edges.forEach((edge) => {
    edge.cursor = nextPage;
  });

  let pullRequests = await Promise.all(edges.map(async (pull) => {
    const { data } = await transformPullRequest({ pullRequest: pull, repository }, pull.user, github);
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
}

module.exports = {
  getPullRequests,
  getNextPage,
};
