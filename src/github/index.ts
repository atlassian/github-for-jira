import issueComment from './issue-comment';
import issue from './issue';
import middleware from './middleware';
import pullRequest from './pull-request';
import push from './push';
import { createBranch, deleteBranch } from './branch';
import webhookTimeout from '../middleware/webhook-timeout';
import bunyan from 'bunyan';
import statsd from '../config/statsd';
import { metricError } from '../config/metric-names';

export default (robot) => {
  const logger = bunyan.createLogger({ name: 'github' });

  // TODO: Need ability to remove these listeners, especially for testing...
  robot.on('*', (context) => {
    const { name, payload } = context;
    logger.info({ event: name, action: payload.action }, 'Event received');

    const tags = [
      `name: webhooks`,
      `event: ${name}`,
      `action: ${payload.action}`,
    ];

    statsd.increment(metricError.jiraConfiguration, tags);
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
