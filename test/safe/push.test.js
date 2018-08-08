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
    })

    it('should update the Jira issue with the linked GitHub commit', async () => {
      const payload = require('../fixtures/push-basic.json')

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

      await app.receive(payload)
    })
  })
})
