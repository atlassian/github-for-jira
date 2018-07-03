const getJiraUtil = require('../../../lib/jira/util')

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

      expect(result).toBe('Should linkify [TEST-123 Example Issue](http://example.com/browse/TEST-123) as a link')
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

      expect(result).toBe('Should linkify [TEST-200 Another Example Issue](http://example.com/browse/TEST-200) and not [TEST-100] as a link')
    })
  })
})
