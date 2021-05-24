const nock = require('nock');

const testTracking = require('../../setup/tracking');
const {
  isDisabled,
  setIsDisabled,
} = require('../../../src/tracking');

let installation;
let subscription;
let deleteGitHubSubscription;
const origDisabledState = isDisabled();

beforeAll(() => {
  setIsDisabled(false);
});

afterAll(() => {
  setIsDisabled(origDisabledState);
});

describe('POST /github/subscription', () => {
  beforeEach(() => {
    td.reset();

    subscription = {
      githubInstallationId: 15,
      jiraHost: 'https://test-host.jira.com',
      destroy: jest.fn().mockResolvedValue(),
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

    const models = td.replace('../../../lib/models');
    td.when(models.Subscription.getSingleInstallation(subscription.jiraHost, subscription.githubInstallationId))
      // Allows us to modify subscription before it's finally called
      .thenDo(async () => subscription);
    td.when(models.Installation.getForHost(installation.jiraHost))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);

    deleteGitHubSubscription = require('../../../src/frontend/delete-github-subscription');
  });

  afterEach(() => {
    td.reset();
  });

  test('Delete Jira Configuration', async () => {
    testTracking();

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
        installations: [{
          id: subscription.githubInstallationId,
          target_type: 'User',
          account: { login },
        }],
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
    await deleteGitHubSubscription(req, res);
    expect(subscription.destroy).toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(202);
  });

  test('Missing githubToken', async () => {
    const req = {
      session: {},
    };

    const res = {
      sendStatus: jest.fn(),
    };

    await deleteGitHubSubscription(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  test.each([
    ['installationId'],
    ['jiraHost'],
  ])('missing body.%s', async (property) => {
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

    await deleteGitHubSubscription(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0]).toMatchSnapshot([{
      err: expect.any(String),
    }]);
  });
});
