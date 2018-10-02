const parseSmartCommit = require('./smart-commit')

function mapCommit (githubCommit, author) {
  const { issueKeys, commands } = parseSmartCommit(githubCommit.message)

  if (!issueKeys) {
    return
  }
  // TODO: tree.sha is not the right SHA
  // REST API doesn't have the same schema
  // So might need to do this with GraphQL
  return {
    commands,
    data: {
      author: {
        avatar: author.avatarUrl,
        email: author.email,
        name: author.name,
        url: author.user ? author.user.url : undefined
      },
      authorTimestamp: githubCommit.authorTimestamp,
      displayId: githubCommit.sha.substring(0, 6),
      fileCount: githubCommit.fileCount,
      hash: githubCommit.sha,
      id: githubCommit.sha,
      issueKeys: issueKeys,
      message: githubCommit.message,
      timestamp: githubCommit.authorTimestamp,
      url: githubCommit.url,
      updateSequenceId: Date.now()
    }
  }
}

module.exports = (payload, authorMap) => {
  const commits = payload.commits.map((commit, index) => mapCommit(commit, authorMap[index]))
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
      url: payload.repository.html_url,
      updateSequenceId: Date.now()
    }
  }
}
