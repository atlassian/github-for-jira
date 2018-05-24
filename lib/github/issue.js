module.exports = async (context, util) => {
  const { issue } = context.payload
  const linkifiedBody = await util.addJiraIssueLinks(issue.body)

  if (linkifiedBody === issue.body) {
    return
  }

  const editedIssue = context.issue({
    body: linkifiedBody,
    id: issue.id
  })

  await context.github.issues.edit(editedIssue)
}
