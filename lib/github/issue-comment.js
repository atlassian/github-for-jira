module.exports = async (context, jiraClient, util) => {
  const { comment } = context.payload

  const issues = jiraClient.issues.parse(comment.body)
  if (!issues) {
    return
  }

  const validIssues = await jiraClient.issues.getAll(issues)
  if (!validIssues.length) {
    return
  }

  const linkifiedBody = await util.addJiraIssueLinks(comment.body, validIssues)
  if (linkifiedBody === comment.body) {
    return
  }

  const editedComment = context.issue({
    body: linkifiedBody,
    comment_id: comment.id
  })

  await context.github.issues.editComment(editedComment)
}
