const parseSmartCommit = require('./smart-commit')

function mapCommit (githubCommit) {
  const { issueKeys, commands } = parseSmartCommit(githubCommit.message)
  const { username } = githubCommit.author

  if (!issueKeys) {
    return
  }

  const fileCount = githubCommit.added.length + githubCommit.removed.length + githubCommit.modified.length

  const result = {
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
      fileCount,
      files: [],
      hash: githubCommit.id,
      id: githubCommit.id,
      issueKeys: issueKeys,
      message: githubCommit.message,
      timestamp: githubCommit.timestamp,
      url: githubCommit.url,
      updateSequenceId: Date.now()
    }
  }
  return result
}

function makeBatches(items, maxSize) {
  const arr = items.slice(0) // shallow copy
  const batches = []
  while (true) {
    var batch = arr.splice(0, maxSize) // destructive read
    if (batch.length === 0) break
    batches.push(batch)
  }
  return batches
}

module.exports = async (payload, visitor) => {
  const batches = makeBatches(payload.commits, 100)
  for (const batch of batches) {
    const commits = batch.map(mapCommit)
    await visitor({
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
}
