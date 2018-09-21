const parseSmartCommit = require('./smart-commit')

function mapFile (githubFile) {
  // changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
  const {
    filename: path,
    status,
    additions: linesAdded,
    deletions: linesRemoved,
    raw_url: url
  } = githubFile;
  return {
    path,
    changeType: status.toUpperCase(),
    linesAdded,
    linesRemoved,
    url
  }
}

async function mapCommit (githubCommit, repository, github) {
  const { issueKeys, commands } = parseSmartCommit(githubCommit.message)
  const { id: sha } = githubCommit
  const { username } = githubCommit.author
  const { owner: { login: owner }, name: repo } = repository

  const { data: commitInfo } = await github.repos.getCommit({ owner, repo, sha })
  const { files } = commitInfo

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
      files: files.map(mapFile),
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

module.exports = async (payload, github) => {
  const { repository } = payload
  const commits = (await Promise.all(payload.commits.map(commit => mapCommit(commit, repository, github))))
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
