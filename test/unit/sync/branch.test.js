const nock = require('nock');
const parseSmartCommit = require('../../../lib/transforms/smart-commit');
const emptyNodesFixture = require('../../fixtures/api/graphql/branch-empty-nodes.json');
const createJob = require('../../setup/create-job');

function makeExpectedResponse({ branchName }) {
  const { issueKeys } = parseSmartCommit(branchName);
  return {
    preventTransitions: true,
    repositories: [
      {
        branches: [
          {
            createPullRequestUrl: `test-repo-url/pull/new/${branchName}`,
            id: branchName,
            issueKeys: ['TES-123'].concat(issueKeys).reverse().filter(Boolean),
            lastCommit: {
              author: {
                avatar: 'https://camo.githubusercontent.com/test-avatar',
                name: 'test-author-name',
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid',
              id: 'test-oid',
              issueKeys: ['TES-123'],
              message: 'TES-123 test-commit-message',
              url: 'test-repo-url/commit/test-sha',
              updateSequenceId: 12345678,
            },
            name: branchName,
            url: `test-repo-url/tree/${branchName}`,
            updateSequenceId: 12345678,
          },
        ],
        commits: [
          {
            author: {
              avatar: 'https://camo.githubusercontent.com/test-avatar',
              email: 'test-author-email@example.com',
              name: 'test-author-name',
            },
            authorTimestamp: 'test-authored-date',
            displayId: 'test-o',
            fileCount: 0,
            hash: 'test-oid',
            id: 'test-oid',
            issueKeys: ['TES-123'],
            message: 'TES-123 test-commit-message',
            timestamp: 'test-authored-date',
            url: 'test-repo-url/commit/test-sha',
            updateSequenceId: 12345678,
          },
        ],
        id: 'test-repo-id',
        name: 'test-repo-name',
        url: 'test-repo-url',
        updateSequenceId: 12345678,
      },
    ],
    properties: {
      installationId: 1234,
    },
  };
}

function nockBranchRequst(payload) {
  const { branchesNoLastCursor, branchesWithLastCursor } = require('../../fixtures/api/graphql/commit-queries');
  nock('https://api.github.com')
    .post('/graphql', branchesNoLastCursor)
    .reply(200, payload);
  nock('https://api.github.com')
    .post('/graphql', branchesWithLastCursor)
    .reply(200, emptyNodesFixture);
}

describe('sync/branches', () => {
  let jiraHost;
  let jiraApi;
  let installationId;
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
          branchStatus: 'pending',
          commitStatus: 'complete',
        },
      },
    };
    delay = process.env.LIMITER_PER_INSTALLATION = 2000;

    jiraHost = process.env.ATLASSIAN_URL;
    jiraApi = td.api('https://test-atlassian-instance.net');

    installationId = 1234;
    Date.now = jest.fn(() => 12345678);

    td.when(
      models.Subscription.getSingleInstallation(jiraHost, installationId),
    ).thenReturn({
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

  test('should sync to Jira when branch refs have jira references', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const branchNodesFixture = require('../../fixtures/api/graphql/branch-ref-nodes.json');
    nockBranchRequst(branchNodesFixture);

    // const queues = {
    // installation: {
    // add: jest.fn(),
    // },
    // };
    // await processInstallation(queues)(job);
    // expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

    // td.verify(
    // jiraApi.post('/rest/devinfo/0.10/bulk', makeExpectedResponse({ branchName: 'TES-321-branch-name' })),
    // );
  });

  /* test('should send data if issue keys are only present in commits', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const branchCommitsHaveKeys = require('../../fixtures/api/graphql/branch-commits-have-keys.json');
    nockBranchRequst(branchCommitsHaveKeys);

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };
    await processInstallation(queues)(job);
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

    td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', makeExpectedResponse({
      branchName: 'dev',
    })));
  });

  test('should send data if issue keys are only present in an associatd PR title', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const associatedPRhasKeys = require('../../fixtures/api/graphql/branch-associated-pr-has-keys.json');
    nockBranchRequst(associatedPRhasKeys);

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
          branches: [
            {
              createPullRequestUrl: 'test-repo-url/pull/new/dev',
              id: 'dev',
              issueKeys: ['PULL-123'],
              lastCommit: {
                author: {
                  avatar: 'https://camo.githubusercontent.com/test-avatar',
                  name: 'test-author-name',
                },
                authorTimestamp: 'test-authored-date',
                displayId: 'test-o',
                fileCount: 0,
                hash: 'test-oid',
                issueKeys: ['PULL-123'],
                id: 'test-oid',
                message: 'test-commit-message',
                url: 'test-repo-url/commit/test-sha',
                updateSequenceId: 12345678,
              },
              name: 'dev',
              url: 'test-repo-url/tree/dev',
              updateSequenceId: 12345678,
            },
          ],
          commits: [],
          id: 'test-repo-id',
          name: 'test-repo-name',
          url: 'test-repo-url',
          updateSequenceId: 12345678,
        },
      ],
      properties: {
        installationId: 1234,
      },
    }));
  });

  test('should not call Jira if no issue keys are found', async () => {
    const { processInstallation } = require('../../../lib/sync/installation');

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });

    const branchNoIssueKeys = require('../../fixtures/api/graphql/branch-no-issue-keys.json');
    nockBranchRequst(branchNoIssueKeys);

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'));

    await processInstallation(queues)(job);
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
  }); */
});
