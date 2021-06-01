/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from "../../setup/tracking";

describe('DELETE /jira/configuration', () => {
  let installation;
  let subscription;
  let deleteJiraConfiguration;

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

    td.when(models.Subscription.getSingleInstallation(subscription.jiraHost, subscription.githubInstallationId))
      // Allows us to modify subscription before it's finally called
      .thenDo(async () => subscription);
    td.when(models.Installation.getForHost(installation.jiraHost))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);

    deleteJiraConfiguration = (await import('../../../src/frontend/delete-jira-configuration')).default;
  });

  it('Delete Jira Configuration', async () => {
    await testTracking();

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
