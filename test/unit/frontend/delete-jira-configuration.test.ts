import testTracking from '../../setup/tracking';
import deleteJiraConfiguration from '../../../src/frontend/delete-jira-configuration';

describe('DELETE /jira/configuration', () => {
  let installation;
  let subscription;

  beforeEach(() => {
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

    const models = td.replace('../../../src/models');
    td.when(models.Subscription.getSingleInstallation(subscription.jiraHost, subscription.githubInstallationId))
      // Allows us to modify subscription before it's finally called
      .thenDo(async () => subscription);
    td.when(models.Installation.getForHost(installation.jiraHost))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);
  });

  it('Delete Jira Configuration', async () => {
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
    await deleteJiraConfiguration(req as any, res as any);
    expect(subscription.destroy).toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
