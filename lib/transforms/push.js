const parseSmartCommit = require('./smart-commit')

function mapCommit (githubCommit, author) {
  const { issueKeys, commands } = parseSmartCommit(githubCommit.message)

  if (!issueKeys) {
    return
  }

  return {
    commands,
    data: {
      author: {
        avatar: author.avatar_url,
        name: author.login,
        url: author.html_url
      },
      authorTimestamp: githubCommit.timestamp,
      displayId: githubCommit.id.substring(0, 6),
      fileCount: githubCommit.added.length + githubCommit.removed.length + githubCommit.modified.length,
      hash: githubCommit.id,
      id: githubCommit.id,
      issueKeys: issueKeys,
      message: githubCommit.message,
      timestamp: githubCommit.timestamp,
      url: githubCommit.url
    }
  }
}

module.exports = (payload, authorMap) => {
  const commits = payload.commits.map(commit => mapCommit(commit, authorMap[commit.author.username]))
    .filter(commit => commit)

  if (commits.length === 0) {
    return {}
  }

  return {
    commands: commits.reduce((commands, commit) => [
      ...commands,
      ...commit.commands
    ], []),
    data: {
      commits: commits.map(commit => commit.data),
      id: payload.repository.id,
      name: payload.repository.full_name,
      url: payload.repository.url
    }
  }
}
