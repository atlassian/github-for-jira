const nock = require('nock');
const createJob = require('../../setup/create-job');

describe('sync/pull-request', () => {
  let jiraHost;
  let jiraApi;
  let installationId;

  beforeEach(() => {
    jest.setTimeout(10000);
    const models = td.replace('../../../lib/models');
    const repoSyncStatus = {
      installationId: 12345678,
      jiraHost: 'tcbyrd.atlassian.net',
      repos: {
        'test-repo-id': {
          repository: {
            name: 'test-repo-name',
            owner: { login: 'integrations' },
            html_url: 'test-repo-url',
            id: 'test-repo-id',
          },
          pullStatus: 'pending',
          branchStatus: 'complete',
          commitStatus: 'complete',
        },
      },
    };

    jiraHost = process.env.ATLASSIAN_URL;
    jiraApi = td.api('https://test-atlassian-instance.net');

    installationId = 1234;
    Date.now = jest.fn(() => 12345678);

    td.when(models.Subscription.getSingleInstallation(jiraHost, installationId))
      .thenReturn({
        jiraHost,
        id: 1,
        get: () => repoSyncStatus,
        set: () => repoSyncStatus,
        save: () => Promise.resolve({}),
        update: () => Promise.resolve({}),
      });
  });

  afterEach(() => {
    td.reset();
  });

  /* describe.each([
    ['[TES-15] Evernote Test', 'use-the-force'],
    ['Evernote Test', 'TES-15'],
  ])('PR Title: %p, PR Head Ref: %p', (title, head) => {
    test('should sync to Jira when Pull Request Nodes have jira references', async () => {
      const { processInstallation } = require('../../../lib/sync/installation');

      const job = createJob({ data: { installationId, jiraHost } });

      const pullRequestList = JSON.parse(JSON.stringify(require('../../fixtures/api/pull-request-list.json')));
      pullRequestList[0].title = title;
      pullRequestList[0].head.ref = head;

      // GET /repos/:owner/:repo/pulls
      nock('https://api.github.com').get('/repos/integrations/test-repo-name/pulls?per_page=20&page=1&state=all&sort=created&direction=desc')
        .reply(200, pullRequestList);
      nock('https://api.github.com').get('/repos/integrations/test-repo-name/pulls/51')
        .reply(200, { comments: 0 });


      const queues = {
        installation: {
          add: jest.fn(),
        },
        pullRequests: {
          add: jest.fn(),
        },
      };
      await processInstallation(queues)(job);

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: true,
        repositories: [
          {
            id: 'test-repo-id',
            pullRequests: [
              {
                author: {
                  avatar: 'https://avatars0.githubusercontent.com/u/173?v=4',
                  name: 'bkeepers',
                  url: 'https://api.github.com/users/bkeepers',
                },
                commentCount: 0,
                destinationBranch: 'test-repo-url/tree/devel',
                displayId: '#51',
                id: 51,
                issueKeys: ['TES-15'],
                lastUpdate: '2018-05-04T14:06:56Z',
                sourceBranch: head,
                sourceBranchUrl: `test-repo-url/tree/${head}`,
                status: 'DECLINED',
                timestamp: '2018-05-04T14:06:56Z',
                title,
                url: 'https://github.com/integrations/test/pull/51',
                updateSequenceId: 12345678,
              },
            ],
            url: 'test-repo-url',
            updateSequenceId: 12345678,
          },
        ],
        properties: { installationId: 1234 },
      }));
    });
  }); */

  test('should not sync if nodes are empty', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost } });

    nock('https://api.github.com').get('/repos/integrations/test-repo-name/pulls?per_page=20&page=1&state=all&sort=created&direction=desc')
      .reply(200, []);

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'));

    const queues = {
      installation: {
        add: jest.fn(),
      },
      pullRequests: {
        add: jest.fn(),
      },
    };
    // await processInstallation(queues)(job);
  //  expect(queues.pullRequests.add).not.toHaveBeenCalled();
  });

  /* test('should not sync if nodes do not contain issue keys', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');
    process.env.LIMITER_PER_INSTALLATION = 2000;
    const job = createJob({ data: { installationId, jiraHost }, opts: { delay: 2000 } });

    const pullRequestList = JSON.parse(JSON.stringify(require('../../fixtures/api/pull-request-list.json')));

    // GET /repos/:owner/:repo/pulls
    nock('https://api.github.com').get('/repos/integrations/test-repo-name/pulls?per_page=20&page=1&state=all&sort=created&direction=desc')
      .reply(200, pullRequestList);

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'));

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };
    await processInstallation(queues)(job);
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
  }); */
});
