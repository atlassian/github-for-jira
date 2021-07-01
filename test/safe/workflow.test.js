const jiraNock = nock(process.env.ATLASSIAN_URL);
const githubNock = nock('https://api.github.com');

describe('GitHub Actions', () => {
  describe('workflow_run', () => {
    beforeEach(() => {
      jest.setTimeout(20000);
    });
    it('should update the Jira issue with the linked GitHub workflow_run', async () => {
      const fixture = require('../fixtures/workflow-basic.json');

      githubNock
        .get('/users/test-workflow-run-user-login')
        .reply(200, {
          login: 'test-workflow-run-author-login',
          avatar_url: 'test-workflow-run-author-avatar',
          html_url: 'test-workflow-run-author-url',
        })
        .get('/repos/test-repo-owner/test-repo-name/check-runs/1')
        .reply(200, [
          {
            id: 1,
            html_url: 'test-repo-url',
            status: 'queued',
            conclusion: null,
            app: {
              id: 1234,
              slug: 'github-actions',
            },
          },
        ]);

      jiraNock.get('/rest/api/latest/issue/TEST-123?fields=summary')
        .reply(200, {
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue',
          },
        });

      githubNock
        .patch('/repos/test-repo-owner/test-repo-name/actions/runs/1', {
          run_id: 'test-pull-request-id',
        })
        .reply(200);

      jiraNock.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
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
      }).reply(200);

      Date.now = jest.fn(() => 12345678);

      await expect(app.receive(fixture)).toResolve();
    });
  });
});
