const { Installation } = require('../../../../src/models');
const getJiraClient = require('../../../../src/jira/client');

const BASE_URL = 'https://base-url.atlassian.net';

describe('Test getting a jira client', () => {
  beforeEach(async () => {
    const installation = await Installation.install({
      host: BASE_URL,
      sharedSecret: 'shared-secret',
      clientKey: 'client-key',
    });
    await installation.enable();
  });

  test('Installation exists', async () => {
    const client = await getJiraClient(BASE_URL, 1, {});
    expect(client).toMatchSnapshot();
  });

  test('Installation does not exist', async () => {
    const installation = await Installation.findOne({
      where: {
        jiraHost: BASE_URL,
      },
    });
    await installation.disable();

    const client = await getJiraClient(BASE_URL, 1, {});
    expect(client).not.toBeDefined();
  });
});
