
describe('Jira axios instance', () => {
  let getJiraAxios;
  beforeEach(async () => {
    getJiraAxios = (await import('../../../../src/jira/client/axios')).default;
  })
  describe('request metrics', () => {
    const jiraHost = 'https://example.atlassian.net';

    describe('when request successful', () => {
      it('sends timing metric', async () => {
        nock(jiraHost).get('/foo/bar').reply(200);

        const jiraAxiosInstance = getJiraAxios(jiraHost, 'secret');

        await expect(async () => {
          await jiraAxiosInstance.get('/foo/bar');
        }).toHaveSentMetrics({
          name: 'jira-integration.jira_request',
          type: 'h',
          tags: {
            path: '/foo/bar',
            method: 'GET',
            status: '200',
            env: 'test',
          },
          value: (value) => value > 0 && value < 1000,
        });
      });

      it('removes URL query params from path', async () => {
        nock(jiraHost).get('/foo/bar?baz=true').reply(200);

        const jiraAxiosInstance = getJiraAxios(jiraHost, 'secret');

        await expect(async () => {
          await jiraAxiosInstance.get('/foo/bar?baz=true');
        }).toHaveSentMetrics({
          name: 'jira-integration.jira_request',
          type: 'h',
          tags: { path: '/foo/bar' },
        });
      });
    });

    describe('when request fails', () => {
      it('sends timing metric', async () => {
        nock(jiraHost).get('/foo/bar').reply(500);

        const jiraAxiosInstance = getJiraAxios(jiraHost, 'secret');

        await expect(async () => {
          try {
            await jiraAxiosInstance.get('/foo/bar');
          } catch (error) {
            // Swallow error
          }
        }).toHaveSentMetrics({
          name: 'jira-integration.jira_request',
          type: 'h',
          tags: {
            path: '/foo/bar',
            method: 'GET',
            status: '500',
            env: 'test',
          },
          value: (value) => value > 0 && value < 1000,
        });
      });
    });
  });
});
