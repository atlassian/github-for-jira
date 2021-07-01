const jiraNock = nock(process.env.ATLASSIAN_URL);
const githubNock = nock('https://api.github.com');

describe('GitHub Actions', () => {
  describe('deployment_status', () => {
    it('should update the Jira issue with the linked GitHub deployment', async () => {
      const fixture = require('../fixtures/deployment-basic.json');

      githubNock
        .get('/users/test-workflow-run-user-login')
        .reply(200, {
          login: 'test-deployment-status-author-login',
          avatar_url: 'test-deployment-status-author-avatar',
          html_url: 'test-deployment-status-author-url',
        });

      jiraNock.get('/rest/api/latest/issue/TEST-123?fields=summary')
        .reply(200, {
          key: 'TEST-123',
          fields: {
            summary: 'Example Issue',
          },
        });

      githubNock
        .patch('/repos/test-repo-owner/test-repo-name/deployments/1', {
          deployment_id: 'test-deployment-status-id',
        })
        .reply(200);

      jiraNock.post('/rest/devinfo/0.10/bulk', {
        preventTransitions: false,
        repositories: [
          {
            name: 'example/test-repo-name',
            url: 'test-repo-url',
            id: 'test-repo-id',
            deployments: [
              {
                id: 123456,
                state: 'pending',
                creator: {
                  login: 'TestUser[bot]',
                  type: 'Bot',
                },
                description: '',
                environment: 'Production',
                target_url: 'test-repo-url/commit/885bee1-commit-id-1c458/checks',
                created_at: '2021-06-28T12:15:18Z',
                updated_at: '2021-06-28T12:15:18Z',
                deployment: {
                  id: 1234,
                  task: 'deploy',
                  original_environment: 'Production',
                  environment: 'Production',
                  description: '',
                  created_at: '2021-06-28T12:15:18Z',
                  updated_at: '2021-06-28T12:15:18Z',
                  creator: {
                    login: 'test-user[bot]',
                    type: 'Bot',
                  },
                },
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
