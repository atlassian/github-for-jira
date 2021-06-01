import testTracking from '../../setup/tracking';

describe('Webhook: /events/uninstalled', () => {
  let installation;
  let subscriptions;
  let uninstall;

  beforeEach(async () => {
    const { getHashedKey } = await import('../../../src/models/installation');
    subscriptions = [{
      gitHubInstallationId: 10,
      jiraHost: 'https://test-host.jira.com',
      uninstall: jest.fn().mockName('uninstall').mockResolvedValue(1),
    }];
    installation = {
      id: 19,
      jiraHost: 'https://test-host.jira.com',
      clientKey: getHashedKey('abc123'),
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      uninstall: jest.fn().mockName('uninstall').mockResolvedValue(installation),
      subscriptions: jest.fn().mockName('subscriptions').mockResolvedValue(subscriptions),
    };

    td.when(models.Subscription.getAllForHost(installation.jiraHost))
      // Allows us to modify subscriptions before it's finally called
      .thenDo(async () => subscriptions);

    uninstall = (await import('../../../src/jira/uninstall')).default;
  });

  it('Existing Installation', async () => {
    await testTracking();
    const req = { log: jest.fn() };
    const res = { locals: { installation }, sendStatus: jest.fn() };
    await uninstall(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.uninstall).toHaveBeenCalled();
    expect(subscriptions[0].uninstall).toHaveBeenCalled();
  });

  it('Existing Installation, no Subscriptions', async () => {
    await testTracking();
    const req = { log: jest.fn() };
    const res = { locals: { installation }, sendStatus: jest.fn() };
    subscriptions = [];
    await uninstall(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.uninstall).toHaveBeenCalled();
  });
});
