const nock = require('nock')

describe('sync/pull-request', () => {
  let jiraHost
  let jiraApi
  let installationId
  let repository

  beforeEach(() => {
    const models = td.replace('../../../lib/models')

    repository = {
      name: 'test',
      owner: { login: 'integrations' },
      html_url: 'test-repo-url'
    }

    jiraHost = process.env.ATLASSIAN_URL
    jiraApi = td.api('https://test-atlassian-instance.net')

    installationId = 'test-installation-id'
    Date.now = jest.fn(() => 12345678)

    td.when(models.Subscription.getSingleInstallation(jiraHost, installationId))
      .thenReturn({
        jiraHost
      })
  })

  test('should sync to Jira when Pull Request Nodes have jira references', async () => {
    const { processPullRequests } = require('../../../lib/sync/pull-request')

    const job = {
      data: { installationId, jiraHost, lastCursor: '1234', repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const fixture = require('../../fixtures/api/graphql/pull-request-nodes.json')
    nock('https://api.github.com').post('/graphql').reply(200, fixture)

    await processPullRequests(app)(job)

    td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: false,
      repositories: [
        {
          pullRequests: [
            {
              author: {
                avatar: 'https://avatars0.githubusercontent.com/u/13207348?v=4',
                name: 'tcbyrd',
                url: 'https://github.com/tcbyrd'
              },
              commentCount: 0,
              destinationBranch: 'test-repo-url/tree/master',
              displayId: '#96',
              id: 96,
              issueKeys: ['TES-15'],
              lastUpdate: '2018-08-23T21:38:05Z',
              sourceBranch: 'evernote-test',
              sourceBranchUrl: 'test-repo-url/tree/evernote-test',
              status: 'OPEN',
              timestamp: '2018-08-23T21:38:05Z',
              title: '[TES-15] Evernote test',
              url: 'https://github.com/tcbyrd/testrepo/pull/96',
              updateSequenceId: 12345678
            }
          ],
          url: 'test-repo-url',
          updateSequenceId: 12345678
        }
      ],
      properties: {
        installationId: 'test-installation-id'
      }
    }))
  })

  test('should sync to Jira when no cursor is provided', async () => {
    const { processPullRequests } = require('../../../lib/sync/pull-request')

    const job = {
      data: { installationId, jiraHost, repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const fixture = require('../../fixtures/api/graphql/pull-request-nodes.json')
    nock('https://api.github.com').post('/graphql').reply(200, fixture)

    await processPullRequests(app)(job)

    td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: false,
      repositories: [
        {
          pullRequests: [
            {
              author: {
                avatar: 'https://avatars0.githubusercontent.com/u/13207348?v=4',
                name: 'tcbyrd',
                url: 'https://github.com/tcbyrd'
              },
              commentCount: 0,
              destinationBranch: 'test-repo-url/tree/master',
              displayId: '#96',
              id: 96,
              issueKeys: ['TES-15'],
              lastUpdate: '2018-08-23T21:38:05Z',
              sourceBranch: 'evernote-test',
              sourceBranchUrl: 'test-repo-url/tree/evernote-test',
              status: 'OPEN',
              timestamp: '2018-08-23T21:38:05Z',
              title: '[TES-15] Evernote test',
              url: 'https://github.com/tcbyrd/testrepo/pull/96',
              updateSequenceId: 12345678
            }
          ],
          url: 'test-repo-url',
          updateSequenceId: 12345678
        }
      ],
      properties: {
        installationId: 'test-installation-id'
      }
    }))
  })

  test('should not sync if nodes are empty', async () => {
    const { processPullRequests } = require('../../../lib/sync/pull-request')

    const job = {
      data: { installationId, jiraHost, lastCursor: '1234', repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const fixture = require('../../fixtures/api/graphql/pull-request-empty-nodes.json')
    nock('https://api.github.com').post('/graphql').reply(200, fixture)

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'))

    await processPullRequests(app)(job)
  })

  test('should not sync if nodes do not contain issue keys', async () => {
    const { processPullRequests } = require('../../../lib/sync/pull-request')

    const job = {
      data: { installationId, jiraHost, repository }
    }

    nock('https://api.github.com').post('/installations/1/access_tokens').reply(200, { token: '1234' })

    const fixture = require('../../fixtures/api/graphql/pull-request-no-keys.json')
    nock('https://api.github.com').post('/graphql').reply(200, fixture)

    td.when(jiraApi.post(), { ignoreExtraArgs: true })
      .thenThrow(new Error('test error'))

    await processPullRequests(app)(job)
  })
})
