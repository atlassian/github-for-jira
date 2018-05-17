const jiraRegex = /\[([A-Z]+-[0-9]+)\]/g

function transformJiraIssueReferences(text) {
  return text.replace(jiraRegex, `[$1](${process.env.ATLASSIAN_URL}/browse/$1)`)
}

module.exports = async (context) => {
  const { comment } = context.payload
  const transformedBody = transformJiraIssueReferences(comment.body)

  if (comment.body === transformedBody) {
    return
  }

  const transformedComment = context.issue({
    body: transformedBody,
    id: comment.id
  })

  await context.github.issues.editComment(transformedComment)
}
