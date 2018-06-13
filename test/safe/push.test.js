const payload = {
  event: 'push',
  payload: {
    action: 'created',
    commits: [
      {
        id: 'test-commit-id',
        hash: 'test-commit-hash',
        author: {
          username: 'test-commit-author-username'
        },
        message: '[TEST-123] Test commit.',
        added: ['test-added'],
        modified: ['test-modified'],
        removed: ['test-removal']
      }
    ],
    repository: {
      id: 'test-repo-id',
      name: 'test-repo-name',
      full_name: 'example/test-repo-name',
      url: 'test-repo-url',
      owner: {
        login: 'test-repo-owner'
      }
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
  describe('push', () => {
    it('should update the Jira issue with the linked GitHub commit', async () => {
      const jiraApi = td.api('https://test-atlassian-instance.net')
      const githubApi = td.api('https://api.github.com')

      td.when(githubApi.get('/users/test-commit-author-username')).thenReturn({
        login: 'test-commit-author-username',
        avatar_url: 'test-commit-author-avatar',
        html_url: 'test-commit-author-url'
      })

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/developmenttool/0.9/devinfo/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            commits: [
              {
                hash: 'test-commit-id',
                message: '[TEST-123] Test commit.',
                author: {
                  name: 'test-commit-author-username',
                  avatar: 'test-commit-author-avatar',
                  url: 'test-commit-author-url'
                },
                displayId: 'test-c',
                fileCount: 3,
                id: 'test-commit-id',
                issueKeys: ['TEST-123']
              }
            ]
          }
        ]
      }))
    })
  })
})
