/* eslint-disable @typescript-eslint/no-explicit-any */
import testTracking from "../../setup/tracking";

describe('Webhook: /events/disabled', () => {
  let installation;
  let getHashedKey;
  let disable;

  beforeEach(async () => {
    getHashedKey = (await import('../../../src/models/installation')).getHashedKey;
    disable = (await import('../../../src/jira/disable')).default;
  })

  it('Existing Installation', async () => {
    await testTracking();
    installation = {
      id: 19,
      jiraHost: 'https://test-host.jira.com',
      clientKey: getHashedKey('abc123'),
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      disable: jest.fn().mockResolvedValue(installation),
      subscriptions: jest.fn().mockResolvedValue([{ gitHubInstallationId: 10 }]),
    };
    const req = { log: jest.fn() };
    const res = { locals: { installation }, sendStatus: jest.fn() };
    await disable(req as any, res as any);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.disable).toHaveBeenCalled();
  });
});
