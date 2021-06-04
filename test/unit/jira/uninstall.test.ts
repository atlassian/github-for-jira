import { mocked } from 'ts-jest/utils';
import { Subscription } from '../../../src/models';
import testTracking from '../../setup/tracking';

jest.mock('../../../src/models');

describe('Webhook: /events/uninstalled', () => {
  let installation;
  let subscription;
  let uninstall;

  beforeEach(async () => {
    const { getHashedKey } = await import('../../../src/models/installation');

    subscription = [
      {
        gitHubInstallationId: 10,
        jiraHost: 'https://test-host.jira.com',
        uninstall: jest.fn().mockName('uninstall').mockResolvedValue(1),
      },
    ];

    installation = {
      id: 19,
      jiraHost: 'https://test-host.jira.com',
      clientKey: getHashedKey('abc123'),
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      uninstall: jest
        .fn()
        .mockName('uninstall')
        .mockResolvedValue(installation),
      subscription: jest
        .fn()
        .mockName('subscription')
        .mockResolvedValue(subscription),
    };

    mocked(Subscription.getAllForHost).mockResolvedValue(subscription);

    uninstall = (await import('../../../src/jira/uninstall')).default;
  });

  it('Existing Installation', async () => {
    await testTracking();

    const req = { log: { info: jest.fn() } };
    const res = { locals: { installation }, sendStatus: jest.fn() };

    await uninstall(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.uninstall).toHaveBeenCalled();
    expect(subscription[0].uninstall).toHaveBeenCalled();
  });

  it('Existing Installation, no Subscription', async () => {
    await testTracking();

    const req = { log: { info: jest.fn() } };
    const res = { locals: { installation }, sendStatus: jest.fn() };

    subscription = [];
    await uninstall(req, res);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(installation.uninstall).toHaveBeenCalled();
  });
});
