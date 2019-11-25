module.exports = async (context, jiraClient, util) => {
  const { issue } = context.payload;

  const linkifiedBody = await util.unfurl(issue.body);
  if (!linkifiedBody) return;

  const editedIssue = context.issue({
    body: linkifiedBody,
    id: issue.id,
  });

  await context.github.issues.edit(editedIssue);
};
