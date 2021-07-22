const { AppSecrets } = require('../../../lib/models');

describe('test appsecret model', () => {
  const appsecretPayload = {
    githubHost: 'ghaebuild48746.ghaekubetest.net',
    clientId: 'a-totally-unique-client-id',
    clientSecret: 'shared-secret',
    privateKey: 'this-is-a-public-key',
    appId: 1,
    webhookSecret: 'webhook-secret',
  };

  beforeEach(async () => {
    const appsecrets = await AppSecrets.insert({
      clientId: appsecretPayload.clientId,
      clientSecret: appsecretPayload.clientSecret,
      privateKey: appsecretPayload.privateKey,
      appId: appsecretPayload.appId,
      githubHost: appsecretPayload.githubHost,
      webhookSecret: appsecretPayload.webhookSecret,
    });

    await AppSecrets.getForHost(appsecretPayload.githubHost);
  });

  afterEach(async () => {
    // Clean up the database
    await AppSecrets.truncate({ cascade: true, restartIdentity: true });
  });

  // Close connection when tests are done
  afterAll(async () => AppSecrets.close());

  it('store appsecrets when it receives an appsecrets payload', async () => {
    const appsecret = await AppSecrets.insert({
      clientId: appsecretPayload.clientId,
      clientSecret: appsecretPayload.clientSecret,
      privateKey: appsecretPayload.privateKey,
      appId: appsecretPayload.appId,
      githubHost: appsecretPayload.githubHost,
      webhookSecret: appsecretPayload.webhookSecret,
    });

    expect(appsecret.githubHost).toBe(appsecretPayload.githubHost);
    expect(appsecret.appId).toBe(appsecretPayload.appId);
    expect(appsecret.clientId).toBe(appsecretPayload.clientId);
  });

  it('retrieves appsecrets based on host', async () => {
    const appsecret = await AppSecrets.getForHost(appsecretPayload.githubHost);

    expect(appsecret.githubHost).toBe(appsecretPayload.githubHost);
    expect(appsecret.appId).toBe(appsecretPayload.appId);
    expect(appsecret.clientId).toBe(appsecretPayload.clientId);
  });
});
