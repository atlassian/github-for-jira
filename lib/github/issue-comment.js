module.exports = async (context) => {
  const { comment } = context.payload
  const linkifiedBody = await context.util.addJiraIssueLinks(comment.body)

  if (linkifiedBody === comment.body) {
    return
  }

  const editedComment = context.issue({
    body: linkifiedBody,
    id: comment.id
  })

  await context.github.issues.editComment(editedComment)
}
