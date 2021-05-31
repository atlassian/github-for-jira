import testTracking from '../../setup/tracking';
import install from '../../../src/jira/install';

describe('Webhook: /events/installed', () => {
  let installation;
  let body;

  beforeEach(() => {
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

    const models = td.replace('../../../src/models');
    td.when(models.Installation.install(td.matchers.anything()))
      // Allows us to modify installation before it's finally called
      .thenDo(async () => installation);
  });

  it('Install', async () => {
    testTracking();
    const req = { log: jest.fn(), body };
    const res = { sendStatus: jest.fn(), on: jest.fn() };
    await install(req as any, res as any);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
