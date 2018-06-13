const parseJiraIssueReferences = require('./parse-jira-issue-references')

const jiraIssueReferenceRegex = /\[([A-Z]+-[0-9]+)\](?!\()/g

module.exports = function (context) {
  async function fetchJiraIssues (issueReferences) {
    const fetchedIssues = await Promise.all(
      issueReferences.map(issueReference =>
        context.jira.issues.get(issueReference, {
          fields: 'summary'
        }).catch(error => error)
      )
    )

    return fetchedIssues
      .filter(response => response.status === 200)
      .map(response => response.data)
  }

  async function addJiraIssueLinks (text) {
    const issueReferences = parseJiraIssueReferences(text)
    const issues = (await fetchJiraIssues(issueReferences))
      .reduce((issues, issue) => ({
        ...issues,
        [issue.key]: issue
      }), {})

    return text.replace(jiraIssueReferenceRegex, (match, issueKey) => {
      if (!issues[issueKey]) {
        return match
      }

      return `[${issueKey} ${issues[issueKey].fields.summary}](${context.jira.baseURL}/browse/${issueKey})`
    })
  }

  return {
    addJiraIssueLinks
  }
}
