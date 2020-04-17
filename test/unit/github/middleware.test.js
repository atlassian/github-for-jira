const { logger } = require('probot/lib/logger');
const Octokit = require('@octokit/rest');

const { Installation, Subscription } = require('../../../lib/models');
const middleware = require('../../../lib/github/middleware');

describe('Probot event middleware', () => {
  describe('when processing fails for one subscription', () => {
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
      const handler = middleware((context, jiraClient, util) => {
        handlerCalls.push([context, jiraClient, util]);

        if (handlerCalls.length === 1) {
          throw Error('boom');
        }
      });

      await handler(context);
    });

    it('calls handler for each subscription', async () => {
      expect(handlerCalls.length).toEqual(3);
    });
  });
});
