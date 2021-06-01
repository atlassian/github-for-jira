const BASE_URL = 'https://base-url.atlassian.net';

describe('Test getting a jira client', () => {
  let getJiraClient;
  beforeEach(async () => {
    const installation = await models.Installation.install({
      host: BASE_URL,
      sharedSecret: 'shared-secret',
      clientKey: 'client-key',
    });
    await installation.enable();
    getJiraClient = (await import('../../../../src/jira/client')).default;
  });

  it('Installation exists', async () => {
    const client = await getJiraClient(BASE_URL, 1);
    expect(client).toMatchSnapshot();
  });

  it('Installation does not exist', async () => {
    const installation = await models.Installation.findOne({
      where: {
        jiraHost: BASE_URL,
      },
    });
    await installation.disable();

    const client = await getJiraClient(BASE_URL, 1);
    expect(client).not.toBeDefined();
  });
});
