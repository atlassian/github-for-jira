/* eslint-disable global-require */

describe('GitHub Actions', () => {
  describe('issue', () => {
    describe('created', () => {
      it('should update the GitHub issue with a linked Jira ticket', async () => {
        const payload = require('../fixtures/issue-basic.json');

        const githubApi = td.api('https://api.github.com');
        const jiraApi = td.api('https://test-atlassian-instance.net');

        td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
          .thenReturn({
            key: 'TEST-123',
            fields: {
              summary: 'Example Issue',
            },
          });

        await app.receive(payload);

        td.verify(githubApi.patch('/repos/test-repo-owner/test-repo-name/issues/123456789', {
          body: 'Test example issue with linked Jira issue: [TEST-123]\n\n[TEST-123]: https://test-atlassian-instance.net/browse/TEST-123',
          id: 'test-issue-id',
        }));
      });

      it('should not break if the issue has a null body', async () => {
        const payload = require('../fixtures/issue-null-body.json');
        // should not throw
        await app.receive(payload);
      });
    });
  });
});
