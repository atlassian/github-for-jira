function parseJiraIssueKeys (text) {
  const jiraIssueRegex = /[A-Z]+-[0-9]+/g

  return text.match(jiraIssueRegex)
}

function mapToJira (githubCommit) {
  return {
    hash: githubCommit.id,
    message: githubCommit.message,
    url: githubCommit.url,
    author: {
      name: githubCommit.author.name,
      email: githubCommit.author.email
    },
    displayId: githubCommit.id.substring(0, 6),
    authorTimestamp: githubCommit.timestamp,
    fileCount: githubCommit.added.length + githubCommit.removed.length + githubCommit.modified.length,
    id: githubCommit.id,
    issueKeys: parseJiraIssueKeys(githubCommit.message),
    timestamp: githubCommit.timestamp
  }
}

module.exports = {
  mapToJira
}
