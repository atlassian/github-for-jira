const { Probot } = require('probot');
const { getPrivateKey } = require('@probot/get-private-key');
const LRUCache = require('lru-cache');

beforeEach(async () => {
  const models = td.replace('../../lib/models', {
    Installation: td.object([
      'getForHost',
      'findByPk',
      'build',
      'getPendingHost',
      'install',
    ]),
    Subscription: td.object([
      'getAllForInstallation',
      'install',
      'getSingleInstallation',
      'findOrStartSync',
      'getAllForHost',
    ]),
    Project: td.object(['upsert']),
  });

  td.when(models.Installation.getForHost(process.env.ATLASSIAN_URL))
    .thenReturn({
      jiraHost: process.env.ATLASSIAN_URL,
      sharedSecret: process.env.ATLASSIAN_SECRET,
    });

  td.when(models.Subscription.getAllForInstallation(1234))
    .thenReturn([
      {
        jiraHost: process.env.ATLASSIAN_URL,
      },
    ]);

  td.when(models.Subscription.getSingleInstallation(process.env.ATLASSIAN_URL, 1234))
    .thenReturn({ id: 1, jiraHost: process.env.ATLASSIAN_URL });

  td.when(models.Project.upsert('PROJ-1', process.env.ATLASSIAN_URL))
    .thenReturn({
      projectKey: 'PROJ',
      upsert: () => Promise.resolve(),
    });

  nock('https://api.github.com')
    .post(/\/app\/installations\/[\d\w-]+\/access_tokens/)
    .reply(200, {
      token: 'mocked-token',
      expires_at: '9999-12-31T23:59:59Z',
    })
    .get('/repos/test-repo-owner/test-repo-name/contents/.github/jira.yml')
    .reply(200, {
      content: Buffer.from(`jira: ${process.env.ATLASSIAN_URL}`).toString('base64'),
    });

  const configureRobot = require('../../lib/configure-robot');
  const { Router } = require('express');

  global.app = await configureRobot(new Probot({
    appId: 12257,
    privateKey: getPrivateKey(),
    octokit: octokit,
    cache: new LRUCache({
      // cache max. 15000 tokens, that will use less than 10mb memory
      max: 15000,
      // Cache for 1 minute less than GitHub expiry
      maxAge: 60 * 60
    })
  }), { getRouter: Router });
});

afterEach(() => {
  nock.cleanAll();
  td.reset();
});
