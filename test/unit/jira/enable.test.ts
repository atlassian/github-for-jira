/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from '../../setup/tracking';

describe('Webhook: /events/enabled', () => {
  let installation;
  let enable;

  beforeEach(async () => {
    installation = {
      id: 19,
      jiraHost: 'https://test-host.jira.com',
      clientKey: 'abc123',
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      subscriptions: jest.fn().mockResolvedValue([]),
    };

    td.when(models.Installation.getPendingHost(installation.jiraHost))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);

    enable = (await import('../../../src/jira/enable')).default;
  });

  it('Pending Installation', async () => {
    await testTracking();
    const req = {
      log: { info: jest.fn() },
      body: { baseUrl: installation.jiraHost },
    };
    const res = { sendStatus: jest.fn(), on: jest.fn() };

    await enable(req as any, res as any);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });

  it('No Pending Installation', async () => {
    installation = null;
    const req = {
      log: { info: jest.fn() },
      body: { baseUrl: 'https://no-exist.jira.com' },
    };
    const res = { sendStatus: jest.fn(), on: jest.fn() };

    await enable(req as any, res as any);
    expect(res.sendStatus).toHaveBeenCalledWith(422);
  });
});
