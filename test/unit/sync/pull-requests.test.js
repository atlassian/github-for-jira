
describe('sync/pull-request', () => {
  test('list with no jira references', async () => {
    const models = td.replace('../../../lib/models')

    const jiraHost = process.env.ATLASSIAN_URL
    const installationId = 1
    Date.now = jest.fn(() => 12345678)

    td.when(models.Subscription.getSingleInstallation(jiraHost, installationId))
      .thenReturn({
        jiraHost
      })

    const processPullRequests = require('../../../lib/sync/pull-request')

    const repository = {
      name: 'test',
      owner: { login: 'integrations' }
    }

    const job = {
      data: { installationId, jiraHost, repository }
    }

    const githubApi = td.api('https://api.github.com')

    td.when(githubApi.get('/repos/integrations/test/pulls?per_page=100&state=all'))
      .thenReturn(require('../../fixtures/api/pull-request-list'))

    await processPullRequests(app)(job)
  })
})
