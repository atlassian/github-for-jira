const nock = require('nock')

describe('sync/pull-request', () => {
  let jiraClient

  beforeEach(() => {
    jiraClient = {
      baseURL: 'http://example.com',
      issues: td.object(['get'])
    }
  })

  test('list with no jira references', async () => {
    const models = td.replace('../../../lib/models')

    const jiraHost = process.env.ATLASSIAN_URL
    const jiraApi = td.api('https://test-atlassian-instance.net')

    const installationId = 1
    Date.now = jest.fn(() => 12345678)

    td.when(models.Subscription.getSingleInstallation(jiraHost, installationId))
      .thenReturn({
        jiraHost
      })

    const { processPullRequests } = require('../../../lib/sync/pull-request')

    const repository = {
      name: 'test',
      owner: { login: 'integrations' }
    }

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
              destinationBranch: 'undefined/tree/',
              displayId: '#96',
              id: 210583241,
              issueKeys: ['TES-15'],
              lastUpdate: '2018-08-23T21:38:05Z',
              sourceBranch: 'undefined/tree/evernote-test',
              status: 'OPEN',
              timestamp: '2018-08-23T21:38:05Z',
              title: '[TES-15] Evernote test',
              url: 'https://github.com/tcbyrd/testrepo/pull/96',
              updateSequenceId: 12345678
            }
          ],
          updateSequenceId: 12345678
        }
      ]
    }))
  })
})
