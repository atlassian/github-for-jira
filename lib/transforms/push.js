const parseSmartCommit = require('./smart-commit')

function mapFile (githubFile) {
  // changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
  // on github when a file is renamed we get two "files": one added, one removed
  const mapStatus = {
    added: 'ADDED',
    removed: 'DELETED',
    modified: 'MODIFIED'
  }
  const {
    filename: path,
    status,
    additions: linesAdded,
    deletions: linesRemoved,
    blob_url: url
  } = githubFile
  return {
    path,
    changeType: mapStatus[status] || 'UNKNOWN',
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

  if (!issueKeys) {
    return
  }

  const { data: commitInfo } = await github.repos.getCommit({ owner, repo, sha })
  const { files } = commitInfo

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
      fileCount: files.length,
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

const batchProcess = async (arr, itemProcessor, batchProcessor, max) => {
  const items = []
  for (const item of arr) {
    const result = await itemProcessor(item)
    if (!result) continue
    items.push(result)
    if (items.length >= max) {
      await batchProcessor(items)
      items.splice(0)
    }
  }
  if (items.length > 0) {
    await batchProcessor(items)
  }
}

const COMMITS_PER_REQUEST = 100
module.exports = async (payload, github, visitor) => {
  const { repository } = payload

  const itemProcessor = (commit) => mapCommit(commit, repository, github)
  const batchProcessor = (commits) => {
    return visitor({
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
    })
  }

  await batchProcess(payload.commits, itemProcessor, batchProcessor, COMMITS_PER_REQUEST)
}
