const nock = require('nock');
const testTracking = require('../../setup/tracking');

let installation;
let subscription;
let deleteJiraConfiguration;

describe('DELETE /jira/configuration', () => {
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

    deleteJiraConfiguration = require('../../../lib/frontend/delete-jira-configuration');
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
      log: { debug: jest.fn() },
      body: { installationId: subscription.githubInstallationId },
      query: {
        xdm_e: subscription.jiraHost,
      },
    };
    const res = { sendStatus: jest.fn(), locals: { installation } };
    await deleteJiraConfiguration(req, res);
    expect(subscription.destroy).toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
