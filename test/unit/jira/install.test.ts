/* eslint-disable @typescript-eslint/no-explicit-any */
import { mocked } from 'ts-jest/utils';
import { Installation } from '../../../src/models';
import testTracking from '../../setup/tracking';

jest.mock('../../../src/models');

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

    mocked(Installation.install).mockResolvedValue(installation);

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
