const jiraIssueReferenceRegex = /\[([A-Z]+-[0-9]+)\](?!\()/g
const jiraIssueRegex = /[A-Z]+-[0-9]+/g

module.exports = function (context) {
  async function findJiraIssueReferences (text, shouldValidate = true) {
    const issues = text.match(jiraIssueRegex)

    if (!shouldValidate) {
      return issues.map(issue => ({
        key: issue
      }))
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
      .map(response => response.data)
  }

  async function addJiraIssueLinks (text, shouldValidate = true) {
    let issues = (await findJiraIssueReferences(text, shouldValidate))
      .reduce((issues, issue) => ({
        ...issues,
        [issue.key]: issue
      }), {})

    return text.replace(jiraIssueReferenceRegex, (match, issueKey) => {
      if (shouldValidate && !issues[issueKey]) {
        return match
      }

      if (shouldValidate) {
        return `[${issueKey} ${issues[issueKey].fields.summary}](${context.jira.baseURL}/browse/${issueKey})`
      }

      return `[${issueKey}](${context.jira.baseURL}/browse/${issueKey})`
    })
  }

  return {
    addJiraIssueLinks
  }
}
