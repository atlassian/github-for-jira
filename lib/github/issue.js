module.exports = async (context) => {
  const { issue } = context.payload
  const linkifiedBody = await context.util.addJiraIssueLinks(issue.body)

  if (linkifiedBody === issue.body) {
    return
  }

  const editedIssue = context.issue({
    body: linkifiedBody,
    id: issue.id
  })

  await context.github.issues.edit(editedIssue)
}
