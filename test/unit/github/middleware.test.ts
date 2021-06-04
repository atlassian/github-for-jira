import { logger } from 'probot/lib/logger';
import { mocked } from 'ts-jest/utils';
import { Installation, Subscription } from '../../../src/models';

jest.mock('../../../src/models');

describe('Probot event middleware', () => {
  let GitHubAPI;
  let middleware;
  let installation;
  let subscription;

  beforeEach(async () => {
    GitHubAPI = (await import('../../../src/config/github-api')).default;
    middleware = (await import('../../../src/github/middleware')).default;
  });

  describe('when processing fails for one subscription', () => {
    let context;
    let handlerCalls;

    beforeEach(async () => {
      context = {
        payload: {
          sender: { type: 'not bot' },
          installation: { id: 1234 },
        },
        github: GitHubAPI(),
        log: logger,
      };

      mocked(Subscription.getAllForInstallation).mockResolvedValue(subscription);
      mocked(Installation.getForHost).mockResolvedValue(installation);

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
