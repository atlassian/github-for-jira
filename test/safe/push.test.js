describe('GitHub Actions', () => {
  describe('push', () => {
    let jiraApi
    let githubApi

    beforeEach(() => {
      jiraApi = td.api('https://test-atlassian-instance.net')
      githubApi = td.api('https://api.github.com')

      td.when(githubApi.get('/users/test-commit-author-username'))
        .thenReturn({
          login: 'test-commit-author-username',
          avatar_url: 'test-commit-author-avatar',
          html_url: 'test-commit-author-url'
        })

      td.when(githubApi.get('/repos/test-repo-owner/test-repo-name/commits/test-commit-id'))
        .thenReturn({
          files: [
            {
              'filename': 'test-modified',
              'additions': 10,
              'deletions': 2,
              'changes': 12,
              'status': 'modified',
              'raw_url': 'https://github.com/octocat/Hello-World/raw/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified',
              'blob_url': 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified',
              'patch': '@@ -29,7 +29,7 @@\n.....'
            },
            {
              'filename': 'test-added',
              'additions': 4,
              'deletions': 0,
              'changes': 4,
              'status': 'added',
              'raw_url': 'https://github.com/octocat/Hello-World/raw/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
              'blob_url': 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
              'patch': '@@ -29,7 +29,7 @@\n.....'
            },
            {
              'filename': 'test-removal',
              'additions': 0,
              'deletions': 4,
              'changes': 4,
              'status': 'removed',
              'raw_url': 'https://github.com/octocat/Hello-World/raw/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal',
              'blob_url': 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal',
              'patch': '@@ -29,7 +29,7 @@\n.....'
            }
          ]
        })
    })

    it('should update the Jira issue with the linked GitHub commit', async () => {
      const payload = require('../fixtures/push-basic.json')

      Date.now = jest.fn(() => 12345678)
      await app.receive(payload)

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
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
                  name: 'test-commit-name',
                  email: 'test-email@example.com',
                  avatar: 'https://github.com/test-commit-author-username.png',
                  url: 'https://github.com/test-commit-author-username'
                },
                displayId: 'test-c',
                fileCount: 3,
                files: [
                  {
                    path: 'test-modified',
                    changeType: 'MODIFIED',
                    linesAdded: 10,
                    linesRemoved: 2,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified'
                  },
                  {
                    path: 'test-added',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added'
                  },
                  {
                    path: 'test-removal',
                    changeType: 'DELETED',
                    linesAdded: 0,
                    linesRemoved: 4,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal'
                  }
                ],
                id: 'test-commit-id',
                issueKeys: ['TEST-123'],
                updateSequenceId: 12345678
              }
            ],
            updateSequenceId: 12345678
          }
        ],
        properties: {
          installationId: 'test-installation-id'
        }
      }))
    })

    it('should update the Jira issue when no username is present', async () => {
      const payload = require('../fixtures/push-no-username.json')

      Date.now = jest.fn(() => 12345678)
      await app.receive(payload)

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
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
                  name: 'test-commit-name',
                  email: 'test-email@example.com'
                },
                displayId: 'test-c',
                fileCount: 3,
                files: [
                  {
                    path: 'test-modified',
                    changeType: 'MODIFIED',
                    linesAdded: 10,
                    linesRemoved: 2,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified'
                  },
                  {
                    path: 'test-added',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added'
                  },
                  {
                    path: 'test-removal',
                    changeType: 'DELETED',
                    linesAdded: 0,
                    linesRemoved: 4,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal'
                  }
                ],
                id: 'test-commit-id',
                issueKeys: ['TEST-123'],
                updateSequenceId: 12345678
              }
            ],
            updateSequenceId: 12345678
          }
        ],
        properties: {
          installationId: 'test-installation-id'
        }
      }))
    })

    it('should run a #comment command in the commit message', async () => {
      const payload = require('../fixtures/push-comment.json')

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/comment', {
        body: 'This is a comment'
      }))
    })

    it('should run a #time command in the commit message', async () => {
      const payload = require('../fixtures/push-worklog.json')

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/worklog', {
        timeSpentSeconds: td.matchers.isA(Number),
        comment: 'This is a worklog'
      }))
    })

    it('should run a transition command in the commit message', async () => {
      const payload = require('../fixtures/push-transition.json')

      td.when(jiraApi.get(`/rest/api/latest/issue/TEST-123/transitions`))
        .thenReturn({
          transitions: [
            {
              id: 'test-transition-id',
              name: 'Resolve'
            }
          ]
        })

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/transitions', {
        transition: {
          id: 'test-transition-id'
        }
      }))
    })

    it('should run a transition command in the commit message', async () => {
      const payload = require('../fixtures/push-transition-comment.json')

      td.when(jiraApi.get(`/rest/api/latest/issue/TEST-123/transitions`))
        .thenReturn({
          transitions: [
            {
              id: 'test-transition-id',
              name: 'Resolve'
            }
          ]
        })

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/transitions', {
        transition: {
          id: 'test-transition-id'
        }
      }))

      td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/comment', {
        body: 'This is a transition'
      }))
    })

    it('should run commands on all issues in the commit message', async () => {
      const payload = require('../fixtures/push-multiple.json')

      await app.receive(payload)

      td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/comment', {
        body: 'This is a comment'
      }))

      td.verify(jiraApi.post('/rest/api/latest/issue/TEST-246/comment', {
        body: 'This is a comment'
      }))
    })

    it('should not run a command without a Jira issue', async () => {
      const payload = require('../fixtures/push-no-issues.json')

      td.when(jiraApi.post(), { ignoreExtraArgs: true })
        .thenThrow(new Error('Should not make any changes to Jira.'))

      await app.receive(payload)
    })

    it('should support commits without smart commands', async () => {
      const payload = require('../fixtures/push-empty.json')

      td.when(jiraApi.post(), { ignoreExtraArgs: true })
        .thenThrow(new Error('Should not make any changes to Jira.'))

      td.when(githubApi.get(), { ignoreExtraArgs: true })
        .thenThrow(new Error('Should not make any API request to GitHub.'))

      await app.receive(payload)
    })
  })
})
