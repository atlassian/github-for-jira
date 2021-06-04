/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from '../../setup/tracking';
import nock from 'nock';

describe('POST /github/subscription', () => {
  let installation;
  let subscription;
  let origDisabledState;
  let setIsDisabled;
  let isDisabled;
  let deleteGitHubSubscription;

  beforeEach(async () => {
    subscription = {
      githubInstallationId: 15,
      jiraHost: 'https://test-host.jira.com',
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    installation = {
      id: 19,
      jiraHost: subscription.jiraHost,
      clientKey: 'abc123',
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      subscriptions: jest.fn().mockResolvedValue([]),
    };

    td.when(
      models.Subscription.getSingleInstallation(
        subscription.jiraHost,
        subscription.githubInstallationId,
      ),
    )
      // Allows us to modify subscription before it's finally called
      .thenDo(async () => subscription);
    td.when(models.Installation.getForHost(installation.jiraHost))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);

    const tracking = await import('../../../src/tracking');
    isDisabled = tracking.isDisabled;
    setIsDisabled = tracking.setIsDisabled;
    deleteGitHubSubscription = (
      await import('../../../src/frontend/delete-github-subscription')
    ).default;

    origDisabledState = isDisabled();
    setIsDisabled(false);
  });

  afterEach(() => {
    setIsDisabled(origDisabledState);
  });

  it('Delete Jira Configuration', async () => {
    await testTracking();

    nock(subscription.jiraHost)
      .delete('/rest/devinfo/0.10/bulkByProperties')
      .query({ installationId: subscription.githubInstallationId })
      .reply(200, 'OK');

    const req = {
      log: { error: jest.fn() },
      body: {
        installationId: subscription.githubInstallationId,
        jiraHost: subscription.jiraHost,
      },
      query: {
        xdm_e: subscription.jiraHost,
      },
      session: {
        githubToken: 'abc-token',
      },
    };

    const login = 'test-user';
    const listInstallations = jest.fn().mockResolvedValue({
      data: {
        installations: [
          {
            id: subscription.githubInstallationId,
            target_type: 'User',
            account: { login },
          },
        ],
      },
    });
    const getAuthenticated = jest.fn().mockResolvedValue({ data: { login } });
    const res = {
      sendStatus: jest.fn(),
      locals: {
        github: {
          apps: { listInstallationsForAuthenticatedUser: listInstallations },
          users: { getAuthenticated },
        },
      },
    };
    await deleteGitHubSubscription(req as any, res as any);
    expect(subscription.destroy).toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(202);
  });

  it('Missing githubToken', async () => {
    const req = {
      session: {},
    };

    const res = {
      sendStatus: jest.fn(),
    };

    await deleteGitHubSubscription(req as any, res as any);
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  test.each([['installationId'], ['jiraHost']])(
    'missing body.%s',
    async (property) => {
      const req = {
        session: { githubToken: 'example-token' },
        body: {
          installationId: 'an installation id',
          jiraHost: 'https://jira-host',
        },
      };
      delete req.body[property];

      const res = {
        status: jest.fn(),
        json: jest.fn(),
      };

      await deleteGitHubSubscription(req as any, res as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0]).toMatchSnapshot([
        {
          err: expect.any(String),
        },
      ]);
    },
  );
});
