const Octokit = require('@octokit/rest')
const nock = require('nock')
const LogDouble = require('../../setup/log-double')

const enhanceOctokit = require('../../../lib/config/enhance-octokit')

describe(enhanceOctokit, () => {
  describe('request metrics', () => {
    let log
    let octokit

    beforeEach(() => {
      log = new LogDouble()
      octokit = Octokit()
    })

    describe('when successful', () => {
      beforeEach(() => {
        nock('https://api.github.com').get(/.+/).reply(200, [])
        enhanceOctokit(octokit, log)
      })

      it('sends reqest timing', async () => {
        await expect(async () => {
          await octokit.activity.listPublicEvents()
        }).toHaveSentMetrics({
          name: 'jira-integration.github-request',
          type: 'h',
          value: (value) => value > 0 && value < 20, // Value changes depending on how long nock takes
          tags: { path: '/events', method: 'GET', status: '200' }
        })
      })

      it('logs request timing', async () => {
        await octokit.activity.listPublicEvents()

        const debugLog = log.debugValues[0]
        expect(log.debugValues).toHaveLength(1)
        expect(debugLog.metadata).toEqual({ path: '/events', method: 'GET', status: 200 })
        expect(debugLog.message).toMatch(/GitHub request time: \d+ms/)
      })
    })

    describe('when fails', () => {
      beforeEach(() => {
        nock('https://api.github.com').get(/.+/).reply(500, [])
        enhanceOctokit(octokit, log)
      })

      it('sends reqest timing', async () => {
        await expect(async () => {
          await octokit.activity.listPublicEvents().catch(() => { /* swallow error */ })
        }).toHaveSentMetrics({
          name: 'jira-integration.github-request',
          type: 'h',
          value: (value) => value > 0 && value < 20, // Value changes depending on how long nock takes
          tags: { path: '/events', method: 'GET', status: '500' }
        })
      })

      it('logs request timing', async () => {
        await octokit.activity.listPublicEvents().catch(() => { /* swallow error */ })

        const debugLog = log.debugValues[0]
        expect(log.debugValues).toHaveLength(1)
        expect(debugLog.metadata).toEqual({ path: '/events', method: 'GET', status: 500 })
        expect(debugLog.message).toMatch(/GitHub request time: \d+ms/)
      })
    })
  })
})
