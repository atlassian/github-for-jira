const nock = require('nock')

const getJiraAxios = require('../../../../lib/jira/client/axios')
const LogDouble = require('../../../setup/log-double')

describe('Jira axios instance', () => {
  describe('request metrics', () => {
    const jiraHost = 'https://example.atlassian.net'

    describe('when request successful', () => {
      it('sends timing metric', async () => {
        nock(jiraHost).get('/foo/bar').reply(200)

        const jiraAxiosInstance = getJiraAxios(jiraHost, 'secret', new LogDouble())

        await expect(async () => {
          await jiraAxiosInstance.get('/foo/bar')
        }).toHaveSentMetrics({
          name: 'jira-integration.jira_request',
          type: 'h',
          tags: { path: '/foo/bar', method: 'GET', status: '200' },
          value: (value) => value > 0 && value < 50
        })
      })

      it('removes URL query params from path', async () => {
        nock(jiraHost).get('/foo/bar?baz=true').reply(200)

        const jiraAxiosInstance = getJiraAxios(jiraHost, 'secret', new LogDouble())

        await expect(async () => {
          await jiraAxiosInstance.get('/foo/bar?baz=true')
        }).toHaveSentMetrics({
          name: 'jira-integration.jira_request',
          type: 'h',
          tags: { path: '/foo/bar' }
        })
      })
    })

    describe('when request fails', () => {
      it('sends timing metric', async () => {
        nock(jiraHost).get('/foo/bar').reply(500)

        const jiraAxiosInstance = getJiraAxios(jiraHost, 'secret', new LogDouble())

        await expect(async () => {
          try {
            await jiraAxiosInstance.get('/foo/bar')
          } catch (error) {
            // Swallow error
          }
        }).toHaveSentMetrics({
          name: 'jira-integration.jira_request',
          type: 'h',
          tags: { path: '/foo/bar', method: 'GET', status: '500' },
          value: (value) => value > 0 && value < 20
        })
      })
    })
  })
})
