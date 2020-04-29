const { Application } = require('probot');
const { findPrivateKey } = require('probot/lib/private-key');
const cacheManager = require('cache-manager');
const { App } = require('@octokit/app');

beforeEach(() => {
  const models = td.replace('../../lib/models', {
    Installation: td.object(['getForHost']),
    Subscription: td.object(['getAllForInstallation', 'install', 'getSingleInstallation']),
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
    .post(/\/installations\/[\d\w-]+\/access_tokens/)
    .reply(200, {
      token: 'mocked-token',
      expires_at: '9999-12-31T23:59:59Z',
    })
    .get('/repos/test-repo-owner/test-repo-name/contents/.github/jira.yml')
    .reply(200, {
      content: Buffer.from(`jira: ${process.env.ATLASSIAN_URL}`).toString('base64'),
    });

  const configureRobot = require('../../lib/configure-robot');

  global.app = configureRobot(new Application({
    app: new App({
      id: 12257,
      privateKey: findPrivateKey(),
    }),
    cache: cacheManager.caching({
      store: 'memory',
      ttl: 60 * 60, // 1 hour
    }),
    throttleOptions: {
      enabled: false,
    },
  }));
});

afterEach(() => {
  nock.cleanAll();
});
