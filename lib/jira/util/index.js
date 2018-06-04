const parseJiraIssueKeys = require('./parse-jira-issue-keys')

const jiraIssueReferenceRegex = /\[([A-Z]+-[0-9]+)\](?!\()/g

module.exports = function (context) {
  async function fetchJiraIssueReferences (issueKeys) {
    const fetchedIssues = await Promise.all(
      issueKeys.map(issue =>
        context.jira.issues.get(issue, {
          fields: 'summary'
        }).catch(error => error)
      )
    )

    return fetchedIssues
      .filter(response => response.status === 200)
      .map(response => response.data)
      .reduce((issues, issue) => ({
        ...issues,
        [issue.key]: issue
      }), {})
  }

  async function addJiraIssueLinks (text) {
    const issueKeys = parseJiraIssueKeys(text)
    const fetchedIssues = await fetchJiraIssueReferences(issueKeys)

    return text.replace(jiraIssueReferenceRegex, (match, issueKey) => {
      if (!fetchedIssues[issueKey]) {
        return match
      }

      return `[${issueKey} ${fetchedIssues[issueKey].fields.summary}](${context.jira.baseURL}/browse/${issueKey})`
    })
  }

  return {
    addJiraIssueLinks
  }
}
