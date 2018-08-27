const parseSmartCommit = require('./smart-commit')

function mapCommit (githubCommit) {
  const { issueKeys, commands } = parseSmartCommit(githubCommit.message)
  const { username } = githubCommit.author

  if (!issueKeys) {
    return
  }

  return {
    commands,
    data: {
      author: {
        avatar: username ? `https://github.com/${username}.png` : undefined,
        email: githubCommit.author.email,
        name: githubCommit.author.name,
        url: username ? `https://github.com/${username}` : undefined
      },
      authorTimestamp: githubCommit.timestamp,
      displayId: githubCommit.id.substring(0, 6),
      fileCount: githubCommit.added.length + githubCommit.removed.length + githubCommit.modified.length,
      hash: githubCommit.id,
      id: githubCommit.id,
      issueKeys: issueKeys,
      message: githubCommit.message,
      timestamp: githubCommit.timestamp,
      url: githubCommit.url,
      updateSequenceId: Date.now()
    }
  }
}

module.exports = (payload) => {
  const commits = payload.commits.map(commit => mapCommit(commit))
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
      url: payload.repository.url,
      updateSequenceId: Date.now()
    }
  }
}
