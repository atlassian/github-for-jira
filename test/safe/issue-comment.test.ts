/* eslint-disable @typescript-eslint/no-var-requires */
describe('GitHub Actions', () => {
  describe('issue_comment', () => {
    describe('created', () => {
      it('should update the GitHub issue with a linked Jira ticket', async () => {
        const payload = require('../fixtures/issue-comment-basic.json');

        const githubApi = global.td.api('https://api.github.com');
        const jiraApi = global.td.api('https://test-atlassian-instance.net');

        global.td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
          .thenReturn({
            key: 'TEST-123',
            fields: {
              summary: 'Example Issue',
            },
          });

        await app.receive(payload);

        global.td.verify(githubApi.patch('/repos/test-repo-owner/test-repo-name/issues/comments/5678', {
          number: 'test-issue-number',
          body: 'Test example comment with linked Jira issue: [TEST-123]\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123',
        }));
      });
    });
  });
});
