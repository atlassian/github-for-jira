const parseSmartCommit = require('./smart-commit')

function mapCommit (githubCommit, author) {
  const { issueKeys } = parseSmartCommit(githubCommit.message)

  if (!issueKeys) {
    return
  }

  return {
    hash: githubCommit.id,
    message: githubCommit.message,
    url: githubCommit.url,
    author: {
      name: author.login,
      avatar: author.avatar_url,
      url: author.html_url
    },
    displayId: githubCommit.id.substring(0, 6),
    authorTimestamp: githubCommit.timestamp,
    fileCount: githubCommit.added.length + githubCommit.removed.length + githubCommit.modified.length,
    id: githubCommit.id,
    issueKeys: issueKeys,
    timestamp: githubCommit.timestamp
  }
}

module.exports = (payload, authorMap) => {
  const commits = payload.commits.map(commit => mapCommit(commit, authorMap[commit.author.username]))
    .filter(commit => commit)

  if (commits.length === 0) {
    return
  }

  return {
    name: payload.repository.full_name,
    url: payload.repository.url,
    id: payload.repository.id,
    commits
  }
}
