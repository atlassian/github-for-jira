import issueComment from './issue-comment';
import issue from './issue';
import middleware from './middleware';
import pullRequest from './pull-request';
import push from './push';
import { createBranch, deleteBranch } from './branch';
import webhookTimeout from '../middleware/webhook-timeout';

export default (robot) => {
  // TODO: Need ability to remove these listeners, especially for testing...
  robot.on('*', (context) => {
    context.log(
      { event: context.name, action: context.payload.action },
      'Event received',
    );
  });

  robot.on(
    ['issue_comment.created', 'issue_comment.edited'],
    webhookTimeout(middleware(issueComment)),
  );

  robot.on(['issues.opened', 'issues.edited'], middleware(issue));

  robot.on('push', middleware(push));

  robot.on(
    [
      'pull_request.opened',
      'pull_request.closed',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request_review',
    ],
    middleware(pullRequest),
  );

  robot.on('create', middleware(createBranch));
  robot.on('delete', middleware(deleteBranch));
};
