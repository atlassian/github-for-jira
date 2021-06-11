import parseSmartCommit from './smart-commit';

function mapCommit(githubCommit, author) {
  const { issueKeys } = parseSmartCommit(githubCommit.message);

  if (!issueKeys) {
    return undefined;
  }

  return {
    data: {
      author: {
        avatar: author.avatarUrl || undefined,
        email: author.email,
        name: author.name,
        url: author.user ? author.user.url : undefined,
      },
      authorTimestamp: githubCommit.authorTimestamp,
      displayId: githubCommit.sha.substring(0, 6),
      fileCount: githubCommit.fileCount,
      hash: githubCommit.sha,
      id: githubCommit.sha,
      issueKeys,
      message: githubCommit.message,
      timestamp: githubCommit.authorTimestamp,
      url: githubCommit.url,
      updateSequenceId: Date.now(),
    },
  };
}

// TODO: type payload and return better
export default (payload, authorMap) => {
  // TODO: use reduce instead of map/filter combo
  const commits = payload.commits.map((commit, index) => mapCommit(commit, authorMap[index]))
    .filter(commit => !!commit);

  if (commits.length === 0) {
    return undefined;
  }

  return {
    data: {
      commits: commits.map(commit => commit.data),
      id: payload.repository.id,
      name: payload.repository.full_name,
      url: payload.repository.html_url,
      updateSequenceId: Date.now(),
    },
  };
};
