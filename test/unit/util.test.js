const getJiraUtil = require('../../lib/jira/util')

describe('Jira util', () => {
  describe('#addJiraIssueLinks', () => {
    let util
    let context

    beforeEach(() => {
      context = {
        jira: {
          baseURL: 'http://example.com',
          issues: td.object(['get'])
        }
      }

      util = getJiraUtil(context)
    })

    it('should linkify Jira references', async () => {
      const text = 'Should linkify [TEST-123] as a link'
      const result = await util.addJiraIssueLinks(text, false)

      expect(result).toBe('Should linkify [TEST-123](http://example.com/browse/TEST-123) as a link')
    })

    it('should linkify Jira references to valid issues', async () => {
      td.when(context.jira.issues.get('TEST-123', {
        fields: 'summary'
      }))
        .thenResolve({
          status: 200,
          data: {
            key: 'TEST-123'
          }
        })

      const text = 'Should linkify [TEST-123] as a link'
      const result = await util.addJiraIssueLinks(text)

      expect(result).toBe('Should linkify [TEST-123](http://example.com/browse/TEST-123) as a link')
    })

    it('should not linkify invalid Jira references', async () => {
      const text = 'Should not linkify TEST-123 as a link'
      const result = await util.addJiraIssueLinks(text, false)

      expect(result).toBe('Should not linkify TEST-123 as a link')
    })

    it('should not linkify Jira references to invalid issues', async () => {
      td.when(context.jira.issues.get('TEST-123', {
        fields: 'summary'
      }))
        .thenReject({
          status: 404
        })

      const text = 'Should not linkify [TEST-123] as a link'
      const result = await util.addJiraIssueLinks(text)

      expect(result).toBe('Should not linkify [TEST-123] as a link')
    })

    it('should linkify only Jira references to valid issues', async () => {
      td.when(context.jira.issues.get('TEST-200', {
        fields: 'summary'
      }))
        .thenResolve({
          status: 200,
          data: {
            key: 'TEST-200'
          }
        })

      td.when(context.jira.issues.get('TEST-100', {
        fields: 'summary'
      }))
        .thenReject({
          status: 404
        })

      const text = 'Should linkify [TEST-200] and not [TEST-100] as a link'
      const result = await util.addJiraIssueLinks(text)

      expect(result).toBe('Should linkify [TEST-200](http://example.com/browse/TEST-200) and not [TEST-100] as a link')
    })
  })
})
