const { GitHubAPI } = require('../../../lib/config/github-api');
const nock = require('nock');
const enhanceOctokit = require('../../../lib/config/enhance-octokit');

describe(enhanceOctokit, () => {
  describe('request metrics - successful', () => {
    let octokit;
    let spyLogDebug;
    let value;

    beforeEach(() => {
      octokit = GitHubAPI();
      enhanceOctokit(octokit);
      spyLogDebug = jest.spyOn(require('bunyan').prototype, 'debug');
      value = (value) => (value > 0 && value < 1000);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('when successful', () => {
      beforeEach(() => {
        nock('https://api.github.com').get('/events').reply(200, []);
      });

      it('sends request timing', async () => {
        await expect(async () => {
          await octokit.activity.listPublicEvents();
        }).toHaveSentMetrics({
          name: 'jira-integration.github-request',
          type: 'h',
          value, // Value changes depending on how long nock takes
          tags: {
            path: '/events',
            method: 'GET',
            status: '200',
            env: 'test',
          },
        });
      });

      it('logs request timing', async () => {
        Date.now = jest.fn(() => 12345678);
        const requestStart = Date.now();

        await octokit.activity.listPublicEvents();

        const elapsed = Date.now() - requestStart;

        expect(spyLogDebug).toHaveBeenCalledTimes(1);
        expect(spyLogDebug).toHaveBeenCalledWith({ method: 'GET', path: '/events', status: 200 }, `GitHub request time: ${elapsed}ms`);
      });
    });

    describe('when fails', () => {
      beforeEach(() => {
        nock('https://api.github.com').get('/events').reply(500, []);
      });

      it('sends request timing', async () => {
        await expect(async () => {
          await octokit.activity.listPublicEvents().catch(() => { /* swallow error */ });
        }).toHaveSentMetrics({
          name: 'jira-integration.github-request',
          type: 'h',
          value: 0,
          tags: {
            path: '/events',
            method: 'GET',
            status: '500',
            env: 'test',
          },
        });
      });

      it('logs request timing', async () => {
        Date.now = jest.fn(() => 12345678);
        const requestStart = Date.now();

        await octokit.activity.listPublicEvents().catch(() => { /* swallow error */ });

        expect(spyLogDebug).toHaveBeenCalledTimes(1);

        const elapsed = Date.now() - requestStart;
        expect(spyLogDebug).toHaveBeenCalledWith({ method: 'GET', path: '/events', status: 500 }, `GitHub request time: ${elapsed}ms`);
      });
    });
  });
});
