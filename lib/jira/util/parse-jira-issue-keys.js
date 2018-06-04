module.exports = function parseJiraIssueKeys (text) {
  const jiraIssueRegex = /[A-Z]+-[0-9]+/g

  return text.match(jiraIssueRegex)
}
