module.exports = async (context, jiraClient, util) => {
  const { comment } = context.payload;

  const linkifiedBody = await util.unfurl(comment.body);
  if (!linkifiedBody) return;

  const editedComment = context.issue({
    body: linkifiedBody,
    comment_id: comment.id,
  });

  await context.github.issues.editComment(editedComment);
};
