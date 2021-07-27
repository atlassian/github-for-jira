const { Probot, ProbotOctokit } = require('probot');
const { getPrivateKey } = require('@probot/get-private-key');

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
    AppSecrets: td.object([
      'insert',
      'getForHost',
    ]),
    Registration: td.object([
      'insert',
      'getRegistration',
      'remove',
    ]),
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

  td.when(models.Registration.getRegistration('abc123'))
    .thenReturn({
      githubHost: process.env.GHAE_URL, state: 'abc123', createdAt: new Date(), remove: () => Promise.resolve(),
    });

  var dt = new Date();
  dt.setHours(dt.getHours() - 2);
  td.when(models.Registration.getRegistration('abc12345'))
    .thenReturn({
      githubHost: process.env.GHAE_URL, state: 'abc12345', createdAt: dt, remove: () => Promise.resolve(),
    });

  td.when(models.Registration.getRegistration('abc1234'))
    .thenReturn({
      githubHost: 'appinstalled.ghaekube.net', state: 'abc1234', createdAt: new Date(), remove: () => Promise.resolve(),
    });

  td.when(models.AppSecrets.getForHost('appinstalled.ghaekube.net'))
    .thenReturn({
      clientId: '12213',
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

  nock('https://ghaebuild4123test.ghaekube.net')
    .post('/api/v3/app-manifests/1234567/conversions')
    .reply(404, {
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/github-ae@latest/rest/reference/apps#create-a-github-app-from-a-manifest',
    })
    .post('/api/v3/app-manifests/12345/conversions')
    .reply(200, {
      client_id: 'client-id',
      client_secret: 'client-secret',
      private_key: 'private-key',
      id: 1,
      html_url: 'https://ghaebuild4123test.ghaekube.net/github-apps/jira-app-testing',
      webhook_secret: 'webhook-secret',
    });

  const configureRobot = require('../../lib/configure-robot');
  const setupGithub = require('../../lib/github');
  const { Router } = require('express');

  const probot = new Probot({
    appId: 12257,
    githubToken: 'test',
    privateKey: getPrivateKey(),
    Octokit: ProbotOctokit.defaults({
      retry: { enabled: false },
      throttle: { enabled: false },
    }),
  });

  global.app = await configureRobot(probot, { getRouter: Router });

  global.webhookApp = await setupGithub(probot);
});

afterEach(() => {
  nock.cleanAll();
  td.reset();
});
