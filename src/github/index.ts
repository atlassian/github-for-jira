import newrelic from 'newrelic';
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
    // TODO: update newrelic type to latest version to fix this compilation issue: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/53429
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    newrelic.setControllerName(`github/events.${context.name}`);
    context.log({ event: context.name, action: context.payload.action }, 'Event received');
  });

  robot.on(['issue_comment.created', 'issue_comment.edited'], webhookTimeout(middleware(issueComment)));

  robot.on(['issues.opened', 'issues.edited'], middleware(issue));

  robot.on('push', middleware(push));

  robot.on([
    'pull_request.opened',
    'pull_request.closed',
    'pull_request.reopened',
    'pull_request.edited',
    'pull_request_review',
  ], middleware(pullRequest));

  robot.on('create', middleware(createBranch));
  robot.on('delete', middleware(deleteBranch));
};
