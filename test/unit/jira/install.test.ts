/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from '../../setup/tracking';

describe('Webhook: /events/installed', () => {
  let installation;
  let body;
  let install;

  beforeEach(async () => {
    body = {
      baseUrl: 'https://test-host.jira.com',
      clientKey: 'abc123',
      sharedSecret: 'ghi345',
    };

    installation = {
      id: 19,
      jiraHost: body.baseUrl,
      clientKey: body.clientKey,
      enabled: true,
      secrets: 'def234',
      sharedSecret: body.sharedSecret,
      subscriptions: jest.fn().mockResolvedValue([]),
    };

    td.when(models.Installation.install(td.matchers.anything()))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);

    install = (await import('../../../src/jira/install')).default;
  });

  it('Install', async () => {
    await testTracking();
    const req = { log: { info: jest.fn() }, body };
    const res = { sendStatus: jest.fn(), on: jest.fn() };

    await install(req as any, res as any);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
