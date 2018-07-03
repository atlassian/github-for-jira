module.exports = async (context, jiraClient, util) => {
  const { issue } = context.payload

  const issues = jiraClient.issues.parse(issue.body)
  if (!issues) {
    return
  }

  const validIssues = await jiraClient.issues.getAll(issues)
  if (!validIssues.length) {
    return
  }

  const linkifiedBody = await util.addJiraIssueLinks(issue.body, validIssues)
  if (linkifiedBody === issue.body) {
    return
  }

  const editedIssue = context.issue({
    body: linkifiedBody,
    id: issue.id
  })

  await context.github.issues.edit(editedIssue)
}
