const parseSmartCommit = require('../../transforms/smart-commit');

/**
 * @param {import('@octokit/rest').Octokit.PullsListResponseItem} payload - The pull request details
 */
function mapStatus({ state, merged_at }) {
  if (state === 'merged') {
    return 'MERGED';
  } else if (state === 'open') {
    return 'OPEN';
  } else if (state === 'closed' && merged_at) {
    return 'MERGED';
  } else if (state === 'closed' && !merged_at) {
    return 'DECLINED';
  } else {
    return 'UNKNOWN';
  }
}

/**
 * Get the author or a ghost user.
 *
 * @param {import('@octokit/rest').Octokit.PullsListResponseItemUser} author - The pull request author
 */
function getAuthor(author) {
  // If author is null, return the ghost user
  if (!author) {
    return {
      avatar: 'https://github.com/ghost.png',
      name: 'Deleted User',
      url: 'https://github.com/ghost',
    };
  }

  return {
    avatar: author.avatar_url,
    name: author.login,
    url: author.url,
  };
}

/**
 * @param {{pullRequest: import('@octokit/rest').Octokit.PullsListResponseItem, repository: import('../pull-request').RepositoryObject}} payload - The pull request details
 * @param {import('@octokit/rest').Octokit.PullsListResponseItemUser} author - The pull request author
 * @param {import('probot').GitHubAPI} github - The GitHub API Object
 */
module.exports = async (payload, author, github) => {
  const { pullRequest, repository } = payload;
  const { issueKeys } = parseSmartCommit(pullRequest.title);

  if (!issueKeys) {
    return {};
  }

  // Comment Count is required by the Jira API, but only do this second fetch if we have issue keys.
  const prGet = await github.pulls.get({
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: pullRequest.number,
  });
  const commentCount = prGet.data.comments;

  return {
    data: {
      id: repository.id,
      name: repository.full_name,
      pullRequests: [
        {
          author: getAuthor(author),
          commentCount,
          destinationBranch: `${repository.html_url}/tree/${pullRequest.base ? pullRequest.base.ref : ''}`,
          displayId: `#${pullRequest.number}`,
          id: pullRequest.number,
          issueKeys,
          lastUpdate: pullRequest.updated_at,
          sourceBranch: `${pullRequest.head ? pullRequest.head.ref : ''}`,
          sourceBranchUrl: `${repository.html_url}/tree/${pullRequest.head ? pullRequest.head.ref : ''}`,
          status: mapStatus(pullRequest),
          timestamp: pullRequest.updated_at,
          title: pullRequest.title,
          url: pullRequest.url,
          updateSequenceId: Date.now(),
        },
      ],
      url: repository.html_url,
      updateSequenceId: Date.now(),
    },
  };
};
