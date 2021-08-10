describe('GitHub Actions', () => {
  let jiraApi; let githubApi; let push; let processPush; let
    createJobData;

  describe('add to push queue', () => {
    beforeEach(() => {
      process.env.REDIS_URL = 'redis://test';
      const { queues } = require('../../lib/worker');
      push = td.replace(queues, 'push');
    });

    it('should add push event to the queue if Jira issue keys are present', async () => {
      const event = require('../fixtures/push-basic.json');
      await app.receive(event);

      td.verify(push.add(
        {
          repository: event.payload.repository,
          shas: [{ id: 'test-commit-id', issueKeys: ['TEST-123'] }],
          jiraHost: process.env.ATLASSIAN_URL,
          installationId: event.payload.installation.id,
        }, { removeOnFail: true, removeOnComplete: true },
      ));
    });

    /* it('should not add push event to the queue if there are no Jira issue keys present', async (done) => {
      const event = require('../fixtures/push-no-issues.json');
      await app.receive(event);
      done();
    });

     it('should handle payloads where only some commits have issue keys', async () => {
      const event = require('../fixtures/push-mixed.json');
      await app.receive(event);
      td.verify(push.add(
        {
          repository: event.payload.repository,
          shas: [
            { id: 'test-commit-id-1', issueKeys: ['TEST-123', 'TEST-246'] },
            { id: 'test-commit-id-2', issueKeys: ['TEST-345'] },
          ],
          jiraHost: 'https://test-atlassian-instance.net',
          installationId: event.payload.installation.id,
        }, { removeOnFail: true, removeOnComplete: true },
      ));
    });
  });

    describe('process push payloads', () => {
    beforeEach(() => {
      jiraApi = td.api(process.env.ATLASSIAN_URL);
      githubApi = td.api('https://api.github.com');
      processPush = require('../../lib/transforms/push').processPush;
      createJobData = require('../../lib/transforms/push').createJobData;
      Date.now = jest.fn(() => 12345678);
    });

    it('should update the Jira issue when no username is present', async () => {
      const event = require('../fixtures/push-no-username.json');
      const job = {
        data: createJobData(event.payload, process.env.ATLASSIAN_URL),
      };

      td.when(githubApi.get('/repos/test-repo-owner/test-repo-name/commits/commit-no-username'))
        .thenReturn(require('../fixtures/api/commit-no-username.json'));

      await processPush()(job);

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            commits: [
              {
                hash: 'commit-no-username',
                message: '[TEST-123] Test commit.',
                author: {
                  email: 'test-email@example.com',
                  name: 'test-commit-name',
                },
                authorTimestamp: 'test-commit-date',
                displayId: 'commit',
                fileCount: 3,
                files: [
                  {
                    path: 'test-modified',
                    changeType: 'MODIFIED',
                    linesAdded: 10,
                    linesRemoved: 2,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified',
                  },
                  {
                    path: 'test-added',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-removal',
                    changeType: 'DELETED',
                    linesAdded: 0,
                    linesRemoved: 4,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal',
                  },
                ],
                id: 'commit-no-username',
                issueKeys: ['TEST-123'],
                url: 'https://github.com/octokit/Hello-World/commit/commit-no-username',
                updateSequenceId: 12345678,
              },
            ],
            updateSequenceId: 12345678,
          },
        ],
        properties: {
          installationId: 1234,
        },
      }));
    });

    it('should only send 10 files if push contains more than 10 files changed', async () => {
      const event = require('../fixtures/push-multiple.json');
      const job = {
        data: createJobData(event.payload, process.env.ATLASSIAN_URL),
      };

      td.when(githubApi.get('/repos/test-repo-owner/test-repo-name/commits/test-commit-id'))
        .thenReturn(require('../fixtures/more-than-10-files.json'));

      await processPush()(job);

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            commits: [
              {
                hash: 'test-commit-id',
                message: 'TEST-123 TEST-246 #comment This is a comment',
                author: {
                  email: 'test-email@example.com',
                  name: 'test-commit-name',
                },
                displayId: 'test-c',
                fileCount: 12,
                files: [
                  {
                    path: 'test-modified',
                    changeType: 'MODIFIED',
                    linesAdded: 10,
                    linesRemoved: 2,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified',
                  },
                  {
                    path: 'test-added-1',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-2',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-3',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-4',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-5',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-6',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-7',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-8',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-added-9',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                ],
                id: 'test-commit-id',
                issueKeys: ['TEST-123', 'TEST-246'],
                updateSequenceId: 12345678,
              },
            ],
            updateSequenceId: 12345678,
          },
        ],
        properties: {
          installationId: 1234,
        },
      }));
    });

    // Commenting these out for the moment. DevInfo API runs these
    // transitions automatially based on the commit message, but we may
    // use them elsewhere for manual transitions
    // it('should run a #comment command in the commit message', async () => {
    //   const payload = require('../fixtures/push-comment.json')

    //   await app.receive(payload)

    //   td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/comment', {
    //     body: 'This is a comment'
    //   }))
    // })

    // it('should run a #time command in the commit message', async () => {
    //   const payload = require('../fixtures/push-worklog.json')

    //   await app.receive(payload)

    //   td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/worklog', {
    //     timeSpentSeconds: td.matchers.isA(Number),
    //     comment: 'This is a worklog'
    //   }))
    // })

    // it('should run a transition command in the commit message', async () => {
    //   const payload = require('../fixtures/push-transition.json')

    //   td.when(jiraApi.get(`/rest/api/latest/issue/TEST-123/transitions`))
    //     .thenReturn({
    //       transitions: [
    //         {
    //           id: 'test-transition-id',
    //           name: 'Resolve'
    //         }
    //       ]
    //     })

    //   await app.receive(payload)

    //   td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/transitions', {
    //     transition: {
    //       id: 'test-transition-id'
    //     }
    //   }))
    // })

    // it('should run a transition command in the commit message', async () => {
    //   const payload = require('../fixtures/push-transition-comment.json')

    //   td.when(jiraApi.get(`/rest/api/latest/issue/TEST-123/transitions`))
    //     .thenReturn({
    //       transitions: [
    //         {
    //           id: 'test-transition-id',
    //           name: 'Resolve'
    //         }
    //       ]
    //     })

    //   await app.receive(payload)

    //   td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/transitions', {
    //     transition: {
    //       id: 'test-transition-id'
    //     }
    //   }))

    //   td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/comment', {
    //     body: 'This is a transition'
    //   }))
    // })

    // it('should run commands on all issues in the commit message', async () => {
    //   const payload = require('../fixtures/push-multiple.json')

    //   await app.receive(payload)

    //   td.verify(jiraApi.post('/rest/api/latest/issue/TEST-123/comment', {
    //     body: 'This is a comment'
    //   }))

    //   td.verify(jiraApi.post('/rest/api/latest/issue/TEST-246/comment', {
    //     body: 'This is a comment'
    //   }))
    // })

     it('should not run a command without a Jira issue', async () => {
      const payload = require('../fixtures/push-no-issues.json');

      td.when(jiraApi.post(), { ignoreExtraArgs: true })
        .thenThrow(new Error('Should not make any changes to Jira.'));

      await app.receive(payload);
    });

    it('should support commits without smart commands', async () => {
      const payload = require('../fixtures/push-empty.json');

      td.when(jiraApi.post(), { ignoreExtraArgs: true })
        .thenThrow(new Error('Should not make any changes to Jira.'));

      td.when(githubApi.get(), { ignoreExtraArgs: true })
        .thenThrow(new Error('Should not make any API request to GitHub.'));

      await app.receive(payload);
    });

    it('should add the MERGE_COMMIT flag when a merge commit is made', async () => {
      const event = require('../fixtures/push-no-username.json');
      const job = {
        data: createJobData(event.payload, process.env.ATLASSIAN_URL),
      };

      td.when(githubApi.get('/repos/test-repo-owner/test-repo-name/commits/commit-no-username'))
        .thenReturn(require('../fixtures/push-merge-commit.json'));

      await processPush()(job);

      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            commits: [
              {
                hash: 'commit-no-username',
                message: '[TEST-123] Test commit.',
                author: { email: 'test-email@example.com', name: 'test-commit-name' },
                authorTimestamp: 'test-commit-date',
                displayId: 'commit',
                fileCount: 3,
                files: [
                  {
                    path: 'test-modified',
                    changeType: 'MODIFIED',
                    linesAdded: 10,
                    linesRemoved: 2,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified',
                  },
                  {
                    path: 'test-added',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-removal',
                    changeType: 'DELETED',
                    linesAdded: 0,
                    linesRemoved: 4,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal',
                  },
                ],
                id: 'commit-no-username',
                issueKeys: ['TEST-123'],
                url: 'https://github.com/octokit/Hello-World/commit/commit-no-username',
                updateSequenceId: 12345678,
                flags: ['MERGE_COMMIT'],
              },
            ],
            updateSequenceId: 12345678,
          },
        ],
        properties: { installationId: 1234 },
      }));
    });

    it('should not add the MERGE_COMMIT flag when a commit is not a merge commit', async () => {
      const event = require('../fixtures/push-no-username.json');
      const job = {
        data: createJobData(event.payload, process.env.ATLASSIAN_URL),
      };

      td.when(githubApi.get('/repos/test-repo-owner/test-repo-name/commits/commit-no-username'))
        .thenReturn(require('../fixtures/push-non-merge-commit'));

      await processPush()(job);

      // flag property should not be present
      td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            commits: [
              {
                hash: 'commit-no-username',
                message: '[TEST-123] Test commit.',
                author: { email: 'test-email@example.com', name: 'test-commit-name' },
                authorTimestamp: 'test-commit-date',
                displayId: 'commit',
                fileCount: 3,
                files: [
                  {
                    path: 'test-modified',
                    changeType: 'MODIFIED',
                    linesAdded: 10,
                    linesRemoved: 2,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-modified',
                  },
                  {
                    path: 'test-added',
                    changeType: 'ADDED',
                    linesAdded: 4,
                    linesRemoved: 0,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-added',
                  },
                  {
                    path: 'test-removal',
                    changeType: 'DELETED',
                    linesAdded: 0,
                    linesRemoved: 4,
                    url: 'https://github.com/octocat/Hello-World/blob/7ca483543807a51b6079e54ac4cc392bc29ae284/test-removal',
                  },
                ],
                id: 'commit-no-username',
                issueKeys: ['TEST-123'],
                url: 'https://github.com/octokit/Hello-World/commit/commit-no-username',
                updateSequenceId: 12345678,
              },
            ],
            updateSequenceId: 12345678,
          },
        ],
        properties: { installationId: 1234 },
      }));
    }); */
  });
});
