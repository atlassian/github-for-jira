const getJiraUtil = require('../../../lib/jira/util')
const { getJiraId } = require('../../../lib/jira/util/id')

describe('Jira util', () => {
  describe('#addJiraIssueLinks', () => {
    let util
    let jiraClient

    beforeEach(() => {
      jiraClient = {
        baseURL: 'http://example.com',
        issues: td.object(['get'])
      }

      util = getJiraUtil(jiraClient)
    })

    it('should linkify Jira references to valid issues', () => {
      const text = 'Should linkify [TEST-123] as a link'
      const issues = [
        {
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue'
          }
        }
      ]

      const result = util.addJiraIssueLinks(text, issues)

      expect(result).toBe('Should linkify [jira/TEST-123](http://example.com/browse/TEST-123) as a link')
    })

    it('should not linkify Jira references to invalid issues', () => {
      const text = 'Should not linkify [TEST-123] as a link'
      const issues = []

      const result = util.addJiraIssueLinks(text, issues)

      expect(result).toBe('Should not linkify [TEST-123] as a link')
    })

    it('should linkify only Jira references to valid issues', () => {
      const text = 'Should linkify [TEST-200] and not [TEST-100] as a link'
      const issues = [
        {
          key: 'TEST-200',
          fields: {
            summary: 'Another Example Issue'
          }
        }
      ]

      const result = util.addJiraIssueLinks(text, issues)

      expect(result).toBe('Should linkify [jira/TEST-200](http://example.com/browse/TEST-200) and not [TEST-100] as a link')
    })

    it('should not re-linkify issue keys in a Markdown URL', async () => {
      const text = '[jira/JRA-090](https://mycompany.atlassian.net/browse/JRA-090)'

      const issues = [
        {
          key: 'JRA-090'
        }
      ]
      const result = util.addJiraIssueLinks(text, issues)
      expect(result).toBe('[jira/JRA-090](https://mycompany.atlassian.net/browse/JRA-090)')
    })

    it('Still linkifies issue keys outside of markdown links', async () => {
      const text = '[jira/JRA-090](https://mycompany.atlassian.net/browse/JRA-090) [JRA-091]'

      const issues = [
        {
          key: 'JRA-090'
        },
        {
          key: 'JRA-091'
        }
      ]

      const result = util.addJiraIssueLinks(text, issues)
      expect(result).toBe('[jira/JRA-090](https://mycompany.atlassian.net/browse/JRA-090) [jira/JRA-091](http://example.com/browse/JRA-091)')
    })
  })

  describe('#getJiraId', () => {
    expect(getJiraId('AP-3-large_push')).toEqual('AP-3-large_push')
    expect(getJiraId('AP-3-large_push/foobar')).toEqual('~41502d332d6c617267655f707573682f666f6f626172')
    expect(getJiraId('feature-something-cool')).toEqual('feature-something-cool')
    expect(getJiraId('feature/something-cool')).toEqual('~666561747572652f736f6d657468696e672d636f6f6c')
  })
})
