const { Installation, Subscription } = require('../../../lib/models');
const { getHashedKey } = require('../../../lib/models/installation');

process.env.STORAGE_SECRET = 'test-secret';

describe('test installation model', () => {
  const newInstallPayload = {
    key: 'com.github.integration.production',
    clientKey: 'a-totally-unique-client-key',
    publicKey: 'this-is-a-public-key',
    sharedSecret: 'shared-secret',
    serverVersion: '100104',
    pluginsVersion: '1.415.0',
    baseUrl: 'https://test-user.atlassian.net',
    productType: 'jira',
    description: 'Atlassian JIRA at https://test-user.atlassian.net ',
    eventType: 'installed',
  };

  // this payload is identical to newInstallPayload except for a renamed `baseUrl`
  const renamedInstallPayload = {
    key: 'com.github.integration.production',
    clientKey: 'a-totally-unique-client-key', // This is the same clientKey as above
    publicKey: 'this-is-a-public-key',
    sharedSecret: 'shared-secret',
    serverVersion: '100104',
    pluginsVersion: '1.415.0',
    baseUrl: 'https://renamed-user.atlassian.net', // This is the only part that's different
    productType: 'jira',
    description: 'Atlassian JIRA at https://renamed-user.atlassian.net ',
    eventType: 'installed',
  };

  // Setup an installation
  const existingInstallPayload = {
    key: 'com.github.integration.production',
    clientKey: 'a-totally-unique-client-key',
    publicKey: 'this-is-a-public-key',
    sharedSecret: 'shared-secret',
    serverVersion: '100104',
    pluginsVersion: '1.415.0',
    baseUrl: 'https://existing-instance.atlassian.net',
    productType: 'jira',
    description: 'Atlassian JIRA at https://existing-instance.atlassian.net ',
    eventType: 'installed',
  };

  beforeEach(async () => {
    const installation = await Installation.install({
      host: existingInstallPayload.baseUrl,
      sharedSecret: existingInstallPayload.sharedSecret,
      clientKey: existingInstallPayload.clientKey,
    });

    // Setup two subscriptions for this host
    await Subscription.install({
      host: installation.jiraHost,
      installationId: '1234',
      clientKey: installation.clientKey,
    });

    await Subscription.install({
      host: installation.jiraHost,
      installationId: '2345',
      clientKey: installation.clientKey,
    });
  });

  afterEach(async () => {
    // Clean up the database
    await Installation.truncate({ cascade: true, restartIdentity: true });
    await Subscription.truncate({ cascade: true, restartIdentity: true });
  });

  // Close connection when tests are done
  afterAll(async () => Installation.close());

  it('installs app when it receives an install payload from jira', async () => {
    const installation = await Installation.install({
      host: newInstallPayload.baseUrl,
      sharedSecret: newInstallPayload.sharedSecret,
      clientKey: newInstallPayload.clientKey,
    });

    expect(installation.jiraHost).toBe(newInstallPayload.baseUrl);

    // We hash the client key with the STORAGE_SECRET variable,
    // so the payload we received should be stored in the database
    // as a hashed key
    const hashedKey = getHashedKey(newInstallPayload.clientKey);
    expect(installation.clientKey).toBe(hashedKey);
  });

  it('updates the jiraHost for an installation when a site is renamed', async () => {
    const newInstallation = await Installation.install({
      host: newInstallPayload.baseUrl,
      sharedSecret: newInstallPayload.sharedSecret,
      clientKey: newInstallPayload.clientKey,
    });
    expect(newInstallation.jiraHost).toBe(newInstallPayload.baseUrl);

    const updatedInstallation = await Installation.install({
      host: renamedInstallPayload.baseUrl,
      sharedSecret: renamedInstallPayload.sharedSecret,
      clientKey: renamedInstallPayload.clientKey,
    });

    expect(updatedInstallation.jiraHost).toBe(renamedInstallPayload.baseUrl);
  });

  it('updates all Subscriptions for a given jira clientKey when a site is renamed', async () => {
    const updatedInstallation = await Installation.install({
      host: renamedInstallPayload.baseUrl,
      sharedSecret: renamedInstallPayload.sharedSecret,
      clientKey: renamedInstallPayload.clientKey,
    });

    const updatedSubscriptions = await Subscription.getAllForClientKey(updatedInstallation.clientKey);
    expect(updatedSubscriptions.length).toBe(2);

    for (const subscription of updatedSubscriptions) {
      expect(subscription.jiraHost).toBe(renamedInstallPayload.baseUrl);
    }
  });
});
