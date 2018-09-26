const parseSmartCommit = require('../../transforms/smart-commit')

function mapBranch (branch, repository) {
  const { issueKeys } = parseSmartCommit(branch.associatedPullRequestTitle)

  if (!issueKeys) {
    return
  }

  const { issueKeys: commitKeys } = parseSmartCommit(branch.lastCommit.message)
  if (commitKeys) {
    issueKeys.push(commitKeys.filter(Boolean))
  }

  const allKeys = issueKeys.filter(Boolean)
    .reduce((a, b) => a.concat(b), [])

  return {
    createPullRequestUrl: `${repository.html_url}/pull/new/${branch.name}`,
    id: branch.name,
    issueKeys: allKeys,
    lastCommit: {
      author: {
        name: branch.lastCommit.author.name
      },
      authorTimestamp: branch.lastCommit.authorTimestamp,
      displayId: branch.lastCommit.sha.substring(0, 6),
      fileCount: branch.lastCommit.fileCount,
      hash: branch.lastCommit.sha,
      id: branch.lastCommit.sha,
      issueKeys: allKeys,
      message: branch.lastCommit.message,
      url: branch.lastCommit.url,
      updateSequenceId: Date.now()
    },
    name: branch.name,
    url: `${repository.html_url}/tree/${branch.name}`,
    updateSequenceId: Date.now()
  }
}

module.exports = (payload, author) => {
  const branches = payload.branches.map(branch => mapBranch(branch, payload.repository))
    .filter(Boolean)

  if (branches.length === 0) {
    return {}
  }

  return {
    data: {
      branches,
      id: payload.repository.id,
      name: payload.repository.name,
      url: payload.repository.html_url,
      updateSequenceId: Date.now()
    }
  }
}
