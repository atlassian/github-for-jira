const parseSmartCommit = require('../../transforms/smart-commit')
const { getJiraId } = require('../../jira/util/id')

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
    id: getJiraId(branch.name),
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

function mapCommit (commit) {
  const { issueKeys } = parseSmartCommit(commit.message)

  if (!issueKeys) {
    return
  }

  return {
    author: {
      email: commit.author.email,
      name: commit.author.name,
      url: commit.author.user ? commit.author.user.url : undefined
    },
    authorTimestamp: commit.authoredDate,
    displayId: commit.oid.substring(0, 6),
    fileCount: 0,
    hash: commit.oid,
    id: commit.oid,
    issueKeys: issueKeys || [],
    message: commit.message,
    timestamp: commit.authoredDate,
    url: commit.url,
    updateSequenceId: Date.now()
  }
}

module.exports = (payload) => {
  const branches = payload.branches.map(branch => mapBranch(branch, payload.repository))
    .filter(Boolean)

  const [commits] = payload.branches.map(branch => {
    return branch.commits.map(commit => mapCommit(commit)).filter(Boolean)
  })

  if (!commits) {
    return {}
  }

  return {
    data: {
      branches,
      commits,
      id: payload.repository.id,
      name: payload.repository.name,
      url: payload.repository.html_url,
      updateSequenceId: Date.now()
    }
  }
}
