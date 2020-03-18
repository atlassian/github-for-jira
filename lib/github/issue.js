module.exports = async (context, jiraClient, util) => {
  const { issue } = context.payload

  const linkifiedBody = await util.unfurl(issue.body)
  if (!linkifiedBody) {
    statsd.increment('noop', { type: 'no_linkified_body_issue' })
    context.log( { noop: 'no_linkified_body_issue' }, 'Halting futher execution for issue since linkifiedBody is empty')
    return
  }

  const editedIssue = context.issue({
    body: linkifiedBody,
    id: issue.id
  })

  await context.github.issues.edit(editedIssue)
}
