const logger = require('../../config/logger');

module.exports = async (context, jiraClient, util) => {
  const { comment } = context.payload;
  const linkifiedBody = await util.unfurl(comment.body);

  if (!linkifiedBody) {
    logger.error({ noop: 'no_linkified_body_issue_comment' }, 'Halting futher execution for issueComment since linkifiedBody is empty');
    return;
  }

  const editedComment = context.issue({
    body: linkifiedBody,
    comment_id: comment.id,
  });

  try {
    await context.github.issues.updateComment(editedComment);
  } catch (err) {
    logger.error(`Error updating comment: ${err}`);
  }
};
