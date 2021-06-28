describe('GitHub Actions', () => {
  describe('workflow_run', () => {
    describe('requested', () => {
      it('should update Jira issue with the linked GitHub workflow_run', async () => {
        const payload = require('../fixtures/workflow-basic.json');

        const jiraApi = td.api('https://test-atlassian-instance.net');
        const githubApi = td.api('https://api.github.com');

        td.when(githubApi.get('/users/test-pull-request-user-login')).thenReturn({
          login: 'test-pull-request-author-login',
          avatar_url: 'test-pull-request-author-avatar',
          html_url: 'test-pull-request-author-url',
        });

        td.when(jiraApi.get('/rest/api/latest/issue/TEST-123?fields=summary'))
          .thenReturn({
            key: 'TEST-123',
            fields: {
              summary: 'Example Issue',
            },
          });

        Date.now = jest.fn(() => 12345678);

        await app.receive(payload);

        td.verify(githubApi.post('/repos/test-repo-owner/test-repo-name/actions/workflows/1/dispatches', {
          ref: 'ref',
          workflow_id: 'test-workflow-id',
        }));

        td.verify(jiraApi.post('/rest/devinfo/0.10/bulk', {
          preventTransitions: false,
          repositories: [
            {
              name: 'example/test-repo-name',
              url: 'test-repo-url',
              id: 'test-repo-id',
              branches: [],
              pull_request: [],
              workflows: [
                {
                  id: 977675483,
                  name: 'My Deployment flow',
                  head_branch: 'TES-123-test-ref',
                  run_number: 84,
                  event: 'push',
                  status: 'queued',
                  conclusion: null,
                  workflow_id: 9751894,
                  check_suite_id: 3099253651,
                  html_url: 'test-repo-url',
                  created_at: '2021-06-28T03:53:34Z',
                  updated_at: '2021-06-28T03:53:34Z',
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
    });

    // describe completed
  });
});
