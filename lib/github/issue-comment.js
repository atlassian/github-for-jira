module.exports = async (context, util) => {
  const { comment } = context.payload
  const linkifiedBody = await util.addJiraIssueLinks(comment.body)

  if (linkifiedBody === comment.body) {
    return
  }

  const editedComment = context.issue({
    body: linkifiedBody,
    id: comment.id
  })

  await context.github.issues.editComment(editedComment)
}
