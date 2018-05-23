const jiraIssueReferenceRegex = /\[([A-Z]+-[0-9]+)\]/g
const jiraIssueRegex = /[A-Z]+-[0-9]+/g

module.exports = function (context) {
  async function findJiraIssueReferences (text, shouldValidate = true) {
    const issues = text.match(jiraIssueRegex)

    if (!shouldValidate) {
      return issues
    }

    const fetchedIssues = await Promise.all(
      issues.map(issue =>
        context.jira.issues.get(issue, {
          fields: 'summary'
        }).catch(error => error)
      )
    )

    return fetchedIssues
      .filter(response => response.status === 200)
      .map(response => response.data.key)
  }

  async function addJiraIssueLinks (text, shouldValidate = true) {
    const issues = await findJiraIssueReferences(text, shouldValidate)

    return text.replace(jiraIssueReferenceRegex, (match, issueKey) => {
      if (shouldValidate && !issues.includes(issueKey)) {
        return match
      }

      return `[${issueKey}](${context.jira.baseURL}/browse/${issueKey})`
    })
  }

  return {
    addJiraIssueLinks
  }
}
