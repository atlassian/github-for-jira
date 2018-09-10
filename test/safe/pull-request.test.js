describe('GitHub Actions', () => {
  describe('pull_request', () => {
    it('should update the Jira issue with the linked GitHub pull_request', async () => {
      const payload = require('../fixtures/pull-request-basic.json')

      const jiraApi = td.api('https://test-atlassian-instance.net')
      const githubApi = td.api('https://api.github.com')

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url'
      })

      Date.now = jest.fn(() => 12345678)

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            pullRequests: [
              {
                author: {
                  name: 'test-pull-request-author-login',
                  avatar: 'test-pull-request-author-avatar',
                  url: 'test-pull-request-author-url'
                },
                commentCount: 'test-pull-request-comment-count',
                destinationBranch: 'test-pull-request-base-url/tree/test-pull-request-base-ref',
                displayId: '#test-pull-request-number',
                id: 'test-pull-request-number',
                issueKeys: ['TEST-123'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'test-pull-request-head-url/tree/test-pull-request-head-ref',
                status: 'OPEN',
                title: '[TEST-123] Test pull request.',
                timestamp: 'test-pull-request-update-time',
                url: 'test-pull-request-url',
                updateSequenceId: 12345678
              }
            ],
            updateSequenceId: 12345678
          }
        ]
      }))
    })
  })
})
