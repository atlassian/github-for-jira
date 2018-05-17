const payload = {
  event: 'issue_comment',
  payload: {
    action: 'created',
    issue: {
      number: 'test-issue-number'
    },
    comment: {
      body: 'Test example with linked Jira issue: [TEST-123]',
      id: 'test-comment-id'
    },
    repository: {
      name: 'test-repo-name',
      owner: {
        login: 'test-repo-owner'
      }
    },
    installation: {
      id: 'test-installation-id'
    }
  }
}

describe('GitHub Actions', () => {
  describe('issue_comment', () => {
    describe('created', () => {
      it('should update the GitHub issue with a linked Jira ticket', async () => {
        process.env.ATLASSIAN_URL = 'test-atlassian-instance.net'

        const editComment = td.request(
          'https://api.github.com',
          '/repos/test-repo-owner/test-repo-name/issues/comments/test-comment-id',
          'PATCH'
        )

        await app.receive(payload)

        td.verify(editComment({
          number: 'test-issue-number',
          body: 'Test example with linked Jira issue: [TEST-123](test-atlassian-instance.net/browse/TEST-123)'
        }))
      })
    })
  })
})
