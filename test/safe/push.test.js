const payload = {
  event: 'push',
  payload: {
    action: 'created',
    commits: [
      {
        id: 'test-commit-id',
        hash: 'test-commit-hash',
        author: {
          name: 'test-commit-author-name',
          email: 'test-commit-author-email'
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
                hash: "test-commit-id",
                message: "[TEST-123] Test commit.",
                author: {
                  name: "test-commit-author-name",
                  email: "test-commit-author-email"
                },
                displayId: "test-c",
                fileCount: 3,
                id: "test-commit-id",
                issueKeys: ["TEST-123"]
              }
            ]
          }
        ]
      }))
    })
  })
})
