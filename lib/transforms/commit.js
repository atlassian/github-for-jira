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
        avatar: author.avatar_url,
        name: author.login,
        url: author.html_url
      },
      authorTimestamp: githubCommit.author.date,
      displayId: githubCommit.tree.sha.substring(0, 6),
      fileCount: 1,
      hash: githubCommit.tree.sha,
      id: githubCommit.tree.sha,
      issueKeys: issueKeys,
      message: githubCommit.message,
      timestamp: githubCommit.author.date,
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
      url: payload.repository.url,
      updateSequenceId: Date.now()
    }
  }
}
