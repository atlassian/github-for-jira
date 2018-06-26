const payload = {
  event: 'pull_request',
  payload: {
    action: 'opened',
    repository: {
      id: 'test-repo-id',
      name: 'test-repo-name',
      full_name: 'example/test-repo-name',
      url: 'test-repo-url',
      owner: {
        login: 'test-repo-owner'
      }
    },
    pull_request: {
      id: 'test-pull-request-id',
      number: 'test-pull-request-number',
      state: 'open',
      title: '[TEST-123] Test pull request.',
      comments: 'test-pull-request-comment-count',
      html_url: 'test-pull-request-url',
      head: {
        repo: {
          html_url: 'test-pull-request-head-url'
        },
        ref: 'test-pull-request-head-ref'
      },
      base: {
        repo: {
          html_url: 'test-pull-request-base-url'
        },
        ref: 'test-pull-request-base-ref'
      },
      user: {
        login: 'test-pull-request-user-login'
      },
      updated_at: 'test-pull-request-update-time'
    },
    sender: {
      type: 'User',
      login: 'TestUser'
    },
    installation: {
      id: 'test-installation-id'
    }
  }
}

describe('GitHub Actions', () => {
  describe('pull_request', () => {
    it('should update the Jira issue with the linked GitHub pull_request', async () => {
      const jiraApi = td.api('https://test-atlassian-instance.net')
      const githubApi = td.api('https://api.github.com')

      td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
        login: 'test-pull-request-author-login',
        avatar_url: 'test-pull-request-author-avatar',
        html_url: 'test-pull-request-author-url'
      })

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/developmenttool/0.9/devinfo/bulk', {
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
                displayId: 'test-pull-request-number',
                id: 'test-pull-request-id',
                issueKeys: ['TEST-123'],
                lastUpdate: 'test-pull-request-update-time',
                sourceBranch: 'test-pull-request-head-url/tree/test-pull-request-head-ref',
                status: 'OPEN',
                title: '[TEST-123] Test pull request.',
                timestamp: 'test-pull-request-update-time',
                url: 'test-pull-request-url'
              }
            ]
          }
        ]
      }))
    })
  })
})
