import url from 'url';
import transformPullRequest from './transforms/pull-request';
import statsd from '../config/statsd';
import { GitHubAPI } from 'probot';
import bunyan from 'bunyan';
import { metricHttpRequest } from '../config/metric-names';
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
 */
export const getNextPage = (headers: Headers = {}): number => {
  const nextUrl = ((headers.link || '').match(/<([^>]+)>;\s*rel="next"/) ||
    [])[1];
  if (!nextUrl) {
    return undefined;
  }
  const logger = bunyan.createLogger({ name: 'pr' });
  logger.info(`pr:`, nextUrl);
  logger.info(`pr:`, typeof nextUrl);
  const parsed = url.parse(nextUrl).query.split('&');
  let nextPage;
  parsed.forEach((query) => {
    const [key, value] = query.split('=');
    if (key === 'page') {
      nextPage = Number(value);
    }
  });
  return nextPage;
};

interface Headers {
  link?: string;
}

export default async function (
  github: GitHubAPI,
  repository,
  cursor: string | number,
  perPage: number,
) {
  let status: number;
  let headers: Headers;
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

  const asyncTags = [];
  await statsd.asyncTimer(
    async () => {
      ({
        data: edges,
        status,
        headers,
      } = await github.pulls.list({
        ...vars,
        state: 'all',
        sort: 'created',
        direction: 'desc',
        // Retry up to 6 times pausing for 10s, for *very* large repos we need to wait a while for the result to succeed in dotcom
        request: {
          retries: 6,
          retryAfter: 10,
        },
      }));
      asyncTags.push(`status:${status}`);
    },
    metricHttpRequest().syncPullRequest,
    1,
    asyncTags,
  )();

  // Force us to go to a non-existant page if we're past the max number of pages
  const nextPage = getNextPage(headers) || cursor + 1;

  // Attach the "cursor" (next page number) to each edge, because the function that uses this data
  // fetches the cursor from one of the edges instead of letting us return it explicitly.
  edges.forEach((edge) => (edge.cursor = nextPage));

  // TODO: change this to reduce
  const pullRequests = (
    await Promise.all(
      edges.map(async (pull) => {
        const data = await transformPullRequest(
          { pullRequest: pull, repository },
          pull.user,
          github,
        );
        return data?.pullRequests[0];
      }),
    )
  ).filter((value) => !!value);

  return {
    edges,
    jiraPayload:
      pullRequests.length > 0
        ? {
            id: repository.id,
            name: repository.full_name,
            pullRequests,
            url: repository.html_url,
            updateSequenceId: Date.now(),
          }
        : undefined,
  };
}
