const nock = require('nock');
const defaultBranchFixture = require('../../fixtures/api/graphql/default-branch.json');
const createJob = require('../../setup/create-job');

describe('sync/commits', () => {
  let jiraHost;
  let jiraApi;
  let installationId;
  let emptyNodesFixture;
  let delay;

  beforeEach(() => {
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
          pullStatus: 'complete',
          branchStatus: 'complete',
          commitStatus: 'pending',
        },
      },
    };
    delay = process.env.LIMITER_PER_INSTALLATION = 2000;
    emptyNodesFixture = require('../../fixtures/api/graphql/commit-empty-nodes.json');

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

  test('should sync to Jira when Commit Nodes have jira references', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const commitNodesFixture = require('../../fixtures/api/graphql/commit-nodes.json');

    const { commitsNoLastCursor, commitsWithLastCursor, getDefaultBranch } = require('../../fixtures/api/graphql/commit-queries');

    nock('https://api.github.com').post('/graphql', getDefaultBranch)
      .reply(200, defaultBranchFixture);
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, commitNodesFixture);
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture);

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };
    // await processInstallation(queues)(job);
    // expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

    /* td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: true,
      repositories: [
        {
          commits: [
            {
              author: {
                email: 'test-author-email@example.com',
                name: 'test-author-name',
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid',
              id: 'test-oid',
              issueKeys: ['TES-17'],
              message: '[TES-17] test-commit-message',
              timestamp: 'test-authored-date',
              url: 'https://github.com/test-login/test-repo/commit/test-sha',
              updateSequenceId: 12345678,
            },
          ],
          id: 'test-repo-id',
          url: 'test-repo-url',
          updateSequenceId: 12345678,
        },
      ],
      properties: {
        installationId: 1234,
      },
    })); */
  });

  /* test('should send Jira all commits that have Issue Keys', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const mixedCommitNodes = require('../../fixtures/api/graphql/commit-nodes-mixed.json');

    const { commitsNoLastCursor, commitsWithLastCursor, getDefaultBranch } = require('../../fixtures/api/graphql/commit-queries');

    nock('https://api.github.com').post('/graphql', getDefaultBranch)
      .reply(200, defaultBranchFixture);
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, mixedCommitNodes);
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture);

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };
    await processInstallation(queues)(job);
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

    td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: true,
      repositories: [
        {
          commits: [
            {
              author: {
                email: 'test-author-email@example.com',
                name: 'test-author-name',
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid-1',
              id: 'test-oid-1',
              issueKeys: ['TES-17'],
              message: '[TES-17] test-commit-message',
              timestamp: 'test-authored-date',
              url: 'https://github.com/test-login/test-repo/commit/test-sha',
              updateSequenceId: 12345678,
            },
            {
              author: {
                avatar: 'test-avatar-url',
                email: 'test-author-email@example.com',
                name: 'test-author-name',
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid-2',
              id: 'test-oid-2',
              issueKeys: ['TES-15'],
              message: '[TES-15] another test-commit-message',
              timestamp: 'test-authored-date',
              url: 'https://github.com/test-login/test-repo/commit/test-sha',
              updateSequenceId: 12345678,
            },
            {
              author: {
                avatar: 'test-avatar-url',
                email: 'test-author-email@example.com',
                name: 'test-author-name',
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid-3',
              id: 'test-oid-3',
              issueKeys: ['TES-14', 'TES-15'],
              message: 'TES-14-TES-15 message with multiple keys',
              timestamp: 'test-authored-date',
              url: 'https://github.com/test-login/test-repo/commit/test-sha',
              updateSequenceId: 12345678,
            },
          ],
          id: 'test-repo-id',
          url: 'test-repo-url',
          updateSequenceId: 12345678,
        },
      ],
      properties: {
        installationId: 1234,
      },
    }));
  });

  test('should default to master branch if defaultBranchRef is null', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const commitNodesFixture = require('../../fixtures/api/graphql/commit-nodes.json');
    const defaultBranchNullFixture = require('../../fixtures/api/graphql/default-branch-null.json');

    const { commitsNoLastCursor, commitsWithLastCursor, getDefaultBranch } = require('../../fixtures/api/graphql/commit-queries');

    nock('https://api.github.com').post('/graphql', getDefaultBranch)
      .reply(200, defaultBranchNullFixture);
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, commitNodesFixture);
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture);

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };
    await processInstallation(queues)(job);
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

    td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: true,
      repositories: [
        {
          commits: [
            {
              author: {
                email: 'test-author-email@example.com',
                name: 'test-author-name',
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid',
              id: 'test-oid',
              issueKeys: ['TES-17'],
              message: '[TES-17] test-commit-message',
              timestamp: 'test-authored-date',
              url: 'https://github.com/test-login/test-repo/commit/test-sha',
              updateSequenceId: 12345678,
            },
          ],
          id: 'test-repo-id',
          url: 'test-repo-url',
          updateSequenceId: 12345678,
        },
      ],
      properties: {
        installationId: 1234,
      },
    }));
  });

  test('should not call Jira if no issue keys are present', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const commitsNoKeys = require('../../fixtures/api/graphql/commit-nodes-no-keys.json');

    const { commitsNoLastCursor, commitsWithLastCursor, getDefaultBranch } = require('../../fixtures/api/graphql/commit-queries');

    nock('https://api.github.com').post('/graphql', getDefaultBranch)
      .reply(200, defaultBranchFixture);
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, commitsNoKeys);
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture);

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'));

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };
    await processInstallation(queues)(job);
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
  });

  test('should not call Jira if no data is returned', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost } });

    const { commitsNoLastCursor, commitsWithLastCursor, getDefaultBranch } = require('../../fixtures/api/graphql/commit-queries');

    nock('https://api.github.com').post('/graphql', getDefaultBranch)
      .reply(200, defaultBranchFixture);
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, emptyNodesFixture);
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture);

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
