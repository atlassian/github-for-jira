const { logger } = require('probot/lib/logger');
const Octokit = require('@octokit/rest');

const { Installation, Subscription } = require('../../../lib/models');
const { middleware, workerMiddleware } = require('../../../lib/github/middleware');
const { queues } = require('../../../lib/worker');

describe('Probot event middleware', () => {
  let context;
  let handlerCalls;

  beforeEach(async () => {
    context = {
      payload: {
        sender: { type: 'not bot' },
        installation: { id: 1234 },
      },
      github: Octokit(),
      log: logger,
    };

    Installation.getForHost = jest.fn((jiraHost) => {
      const installations = [
        { jiraHost: 'https://foo.atlassian.net', sharedSecret: 'secret1' },
        { jiraHost: 'https://bar.atlassian.net', sharedSecret: 'secret2' },
        { jiraHost: 'https://baz.atlassian.net', sharedSecret: 'secret3' },
      ];

      return installations.find(installation => installation.jiraHost === jiraHost);
    });

    Subscription.getAllForInstallation = jest.fn().mockReturnValue([
      { jiraHost: 'https://foo.atlassian.net' },
      { jiraHost: 'https://bar.atlassian.net' },
      { jiraHost: 'https://baz.atlassian.net' },
    ]);

    handlerCalls = [];
  });

  describe('inline webhook processing', () => {
    it('calls handler for each subscription, even when one fails', async () => {
      const handler = middleware((context, jiraClient, util) => {
        handlerCalls.push([context, jiraClient, util]);

        if (handlerCalls.length === 1) {
          throw Error('boom');
        }
      });

      await handler(context);
      expect(handlerCalls.length).toEqual(3);
    });
  });

  describe('async webhook processing', () => {
    it('enqueues webhook job if there is at least one subscription', async () => {
      const handler = workerMiddleware('pullRequest');
      await handler(context);
      const counts = await queues.webhook.getJobCounts();
      expect(counts.waiting).toEqual(1);
    });

    it('does not enqueue anything if there are no subscriptions', async () => {
      context.payload.installation.id = 9999; // this doesn't exist in the test fixtures
      const handler = workerMiddleware('pullRequest');
      await handler(context);
      const counts = await queues.webhook.getJobCounts();
      expect(counts.waiting).toEqual(0);
    });
  });
});
