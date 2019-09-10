const Octokit = require('@octokit/rest')
const nock = require('nock')

const enhanceOctokit = require('../../../lib/config/enhance-octokit')

describe(enhanceOctokit, () => {
  describe('request metrics', () => {
    it('sends reqest timing', async () => {
      nock('https://api.github.com').get(/.+/).reply(200, [])

      const log = { debug: () => {} }
      const octokit = Octokit()

      enhanceOctokit(octokit, log)

      await expect(async () => {
        await octokit.activity.listPublicEvents()
      }).toHaveSentMetrics({
        name: 'jira-integration.github-request',
        type: 'h',
        value: (value) => value > 0 && value < 20, // Value changes depending on how long nock takes
        tags: { path: '/events', method: 'GET' }
      })
    })
  })
})
