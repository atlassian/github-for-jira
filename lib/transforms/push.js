const parseJiraIssueKeys = require('../jira/util/parse-jira-issue-keys')

function mapCommit(githubCommit, author) {
  const issueKeys = parseJiraIssueKeys(githubCommit.message)

  if (!issueKeys) {
    return
  }

  return {
    hash: githubCommit.id,
    message: githubCommit.message,
    url: githubCommit.url,
    author: {
      name: author.name,
      email: author.email
    },
    displayId: githubCommit.id.substring(0, 6),
    authorTimestamp: githubCommit.timestamp,
    fileCount: githubCommit.added.length + githubCommit.removed.length + githubCommit.modified.length,
    id: githubCommit.id,
    issueKeys: issueKeys,
    timestamp: githubCommit.timestamp
  }
}

module.exports = function mapToJira(payload) {
  const commits = payload.commits.map(mapCommit).filter(commit => commit)

  if (commits.length === 0) {
    return
  }

  return {
    name: payload.repository.full_name,
    url: payload.repository.url,
    id: payload.repository.id,
    commits
  }
}
