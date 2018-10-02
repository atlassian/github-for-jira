const nock = require('nock')

describe('sync/commits', () => {
  let jiraHost
  let jiraApi
  let installationId
  let repository
  let emptyNodesFixture

  beforeEach(() => {
    const models = td.replace('../../../lib/models')
    const repoSyncStateFixture = require('../../../lib/models/sync-state.example.json')

    emptyNodesFixture = require('../../fixtures/api/graphql/commit-empty-nodes.json')

    repository = {
      name: 'test-repo-name',
      owner: { login: 'integrations' },
      html_url: 'test-repo-url',
      id: 'test-repo-id'
    }

    jiraHost = process.env.ATLASSIAN_URL
    jiraApi = td.api('https://test-atlassian-instance.net')

    installationId = 'test-installation-id'
    Date.now = jest.fn(() => 12345678)

    td.when(models.Subscription.getSingleInstallation(jiraHost, installationId))
      .thenReturn({
        jiraHost,
        id: 1,
        get: () => repoSyncStateFixture,
        set: () => repoSyncStateFixture,
        save: () => Promise.resolve({}),
        update: () => Promise.resolve({})
      })
  })

  test('should sync to Jira when Commit Nodes have jira references', async () => {
    const { processCommits } = require('../../../lib/sync/commits')

    const job = {
      data: { installationId, jiraHost, lastCursor: '1234', repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const commitNodesFixture = require('../../fixtures/api/graphql/commit-nodes.json')

    const { commitsNoLastCursor, commitsWithLastCursor } = require('../../fixtures/api/graphql/commit-queries')
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, commitNodesFixture)
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture)

    await processCommits(app)(job)

    td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: false,
      repositories: [
        {
          commits: [
            {
              author: {
                email: 'test-author-email@example.com',
                name: 'test-author-name'
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
              updateSequenceId: 12345678
            }
          ],
          id: 'test-repo-id',
          url: 'test-repo-url',
          updateSequenceId: 12345678
        }
      ],
      properties: {
        installationId: 'test-installation-id'
      }
    }))
  })

  test('should send Jira all commits that have Issue Keys', async () => {
    const { processCommits } = require('../../../lib/sync/commits')

    const job = {
      data: { installationId, jiraHost, lastCursor: '1234', repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const mixedCommitNodes = require('../../fixtures/api/graphql/commit-nodes-mixed.json')

    const { commitsNoLastCursor, commitsWithLastCursor } = require('../../fixtures/api/graphql/commit-queries')
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, mixedCommitNodes)
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture)

    await processCommits(app)(job)

    td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: false,
      repositories: [
        {
          commits: [
            {
              author: {
                email: 'test-author-email@example.com',
                name: 'test-author-name'
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
              updateSequenceId: 12345678
            },
            {
              author: {
                email: 'test-author-email@example.com',
                name: 'test-author-name'
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid',
              id: 'test-oid',
              issueKeys: ['TES-15'],
              message: '[TES-15] another test-commit-message',
              timestamp: 'test-authored-date',
              url: 'https://github.com/test-login/test-repo/commit/test-sha',
              updateSequenceId: 12345678
            },
            {
              author: {
                email: 'test-author-email@example.com',
                name: 'test-author-name'
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid',
              id: 'test-oid',
              issueKeys: ['TES-14', 'TES-15'],
              message: 'TES-14-TES-15 message with multiple keys',
              timestamp: 'test-authored-date',
              url: 'https://github.com/test-login/test-repo/commit/test-sha',
              updateSequenceId: 12345678
            }
          ],
          id: 'test-repo-id',
          url: 'test-repo-url',
          updateSequenceId: 12345678
        }
      ],
      properties: {
        installationId: 'test-installation-id'
      }
    }))
  })

  test('should not call Jira if no issue keys are present', async () => {
    const { processCommits } = require('../../../lib/sync/commits')

    const job = {
      data: { installationId, jiraHost, lastCursor: '1234', repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const commitsNoKeys = require('../../fixtures/api/graphql/commit-nodes-no-keys.json')

    const { commitsNoLastCursor, commitsWithLastCursor } = require('../../fixtures/api/graphql/commit-queries')
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, commitsNoKeys)
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture)

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'))

    await processCommits(app)(job)
  })

  test('should not call Jira if no data is returned', async () => {
    const { processCommits } = require('../../../lib/sync/commits')

    const job = {
      data: { installationId, jiraHost, lastCursor: '1234', repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const { commitsNoLastCursor, commitsWithLastCursor } = require('../../fixtures/api/graphql/commit-queries')
    nock('https://api.github.com').post('/graphql', commitsNoLastCursor)
      .reply(200, emptyNodesFixture)
    nock('https://api.github.com').post('/graphql', commitsWithLastCursor)
      .reply(200, emptyNodesFixture)

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'))

    await processCommits(app)(job)
  })
})
