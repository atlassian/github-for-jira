const parseSmartCommit = require('../../transforms/smart-commit');
const { getJiraId } = require('../../jira/util/id');

/**
 * mapBranch takes a branch node from the GraphQL response and
 * attempts to find issueKeys in use anywhere in that object
 *
 * Locations can include:
 *  - Branch Name (ref)
 *  - Title of the associated Pull Request
 *  - Messages from up to the last 100 commits in that branch
 *
 * @param {object} branch - The branch object
 * @param {object} repository - The repository object
 */
function mapBranch(branch, repository) {
  const { issueKeys: branchKeys } = parseSmartCommit(branch.name);
  const { issueKeys: pullRequestKeys } = parseSmartCommit(branch.associatedPullRequestTitle);
  const { issueKeys: commitKeys } = parseSmartCommit(branch.lastCommit.message);

  const allKeys = []
    .concat(branchKeys)
    .concat(pullRequestKeys)
    .concat(commitKeys)
    .filter(Boolean);

  if (!allKeys.length) {
    // If we get here, no issue keys were found anywhere they might be found
    return;
  }

  return {
    createPullRequestUrl: `${repository.html_url}/pull/new/${branch.name}`,
    id: getJiraId(branch.name),
    issueKeys: allKeys,
    lastCommit: {
      author: {
        avatar: branch.lastCommit.author.avatarUrl,
        name: branch.lastCommit.author.name,
      },
      authorTimestamp: branch.lastCommit.authorTimestamp,
      displayId: branch.lastCommit.sha.substring(0, 6),
      fileCount: branch.lastCommit.fileCount,
      hash: branch.lastCommit.sha,
      id: branch.lastCommit.sha,
      // Use only one set of keys for the last commit in order of most specific to least specific
      issueKeys: commitKeys || branchKeys || pullRequestKeys,
      message: branch.lastCommit.message,
      url: branch.lastCommit.url,
      updateSequenceId: Date.now(),
    },
    name: branch.name,
    url: `${repository.html_url}/tree/${branch.name}`,
    updateSequenceId: Date.now(),
  };
}

/**
 * mapCommit takes the a single commit object from the array
 * of commits we got from the GraphQL response and maps the data
 * to the structure needed for the DevInfo API
 *
 * @param {object} commit - The commit object
 */
function mapCommit(commit) {
  const { issueKeys } = parseSmartCommit(commit.message);

  if (!issueKeys) {
    return;
  }

  return {
    author: {
      avatar: commit.author.avatarUrl,
      email: commit.author.email,
      name: commit.author.name,
      url: commit.author.user ? commit.author.user.url : undefined,
    },
    authorTimestamp: commit.authoredDate,
    displayId: commit.oid.substring(0, 6),
    fileCount: 0,
    hash: commit.oid,
    id: commit.oid,
    issueKeys: issueKeys || [],
    message: commit.message,
    timestamp: commit.authoredDate,
    url: commit.url,
    updateSequenceId: Date.now(),
  };
}

module.exports = (payload) => {
  const branches = payload.branches.map(branch => mapBranch(branch, payload.repository))
    .filter(Boolean);

  const commits = payload.branches.flatMap(
    branch => branch.commits.map(commit => mapCommit(commit)).filter(Boolean),
  );

  if ((!commits || !commits.length) && (!branches || !branches.length)) {
    return {};
  }

  return {
    data: {
      branches,
      commits,
      id: payload.repository.id,
      name: payload.repository.name,
      url: payload.repository.html_url,
      updateSequenceId: Date.now(),
    },
  };
};
