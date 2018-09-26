const parseSmartCommit = require('../../transforms/smart-commit')

function mapBranch (branch, repository) {
  const { issueKeys } = parseSmartCommit(branch.name)

  if (!issueKeys) {
    return
  }

  return {
    createPullRequestUrl: `${repository.html_url}/pull/new/${branch.name}`,
    id: branch.name,
    issueKeys,
    lastCommit: {
      author: {
        name: branch.author.name
      },
      authorTimestamp: branch.authorTimestamp,
      displayId: branch.lastCommit.sha.substing(0, 6),
      fileCount: branch.lastCommit.fileCount,
      hash: branch.lastCommit.sha,
      id: branch.lastCommit.sha,
      issueKeys,
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

  if (branches.length === 0) {
    return {}
  }

  return {
    data: {
      branches,
      id: payload.repository.id,
      name: payload.repository.full_name,
      url: payload.repository.url,
      updateSequenceId: Date.now()
    }
  }
}
