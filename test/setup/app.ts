import {Application} from 'probot';
import {findPrivateKey} from 'probot/lib/private-key';
import {caching} from 'cache-manager';
import {App} from '@octokit/app';
import configureRobot from '../../src/configure-robot';

declare global {
  let app: Application;
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      app: Application;
    }
  }
}

beforeEach(async () => {
  const models = td.replace('../../src/models', {
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
    Project: td.object(['incrementOccurence']),
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
    .thenReturn({id: 1, jiraHost: process.env.ATLASSIAN_URL});

  td.when(models.Project.incrementOccurence('PROJ-1', process.env.ATLASSIAN_URL))
    .thenReturn({
      projectKey: 'PROJ'
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

  global.app = await configureRobot(new Application({
    app: new App({
      id: 12257,
      privateKey: findPrivateKey(),
    }),
    cache: caching({
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
