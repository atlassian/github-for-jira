const transformPullRequest = require('../../../../src/sync/transforms/pull-request');

describe('pull_request transform', () => {
  it('should send the ghost user to Jira when GitHub user has been deleted', async () => {
    const pullRequestList = JSON.parse(JSON.stringify(require('../../../fixtures/api/pull-request-list.json')));
    pullRequestList[0].title = '[TES-123] Evernote Test';
    const payload = {
      pullRequest: pullRequestList[0],
      repository: {
        id: 1234568,
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
        owner: { login: 'test-login' },
        html_url: 'https://github.com/test-owner/test-repo',
      },
    };
    payload.pullRequest.user = null;
    const githubMock = {
      pulls: {
        get: () => ({ data: { comments: 1 } }),
      },
    };

    Date.now = jest.fn(() => 12345678);

    const { data } = await transformPullRequest(payload, payload.pullRequest.user, githubMock);
    expect(data).toMatchObject({
      id: 1234568,
      name: 'test-owner/test-repo',
      pullRequests: [
        {
          // 'ghost' is a special user GitHub associates with
          // comments/PRs when a user deletes their account
          author: {
            avatar: 'https://github.com/ghost.png',
            name: 'Deleted User',
            url: 'https://github.com/ghost',
          },
          commentCount: 1,
          destinationBranch: 'https://github.com/test-owner/test-repo/tree/devel',
          displayId: '#51',
          id: 51,
          issueKeys: ['TES-123'],
          lastUpdate: pullRequestList[0].updated_at,
          sourceBranch: 'use-the-force',
          sourceBranchUrl: 'https://github.com/test-owner/test-repo/tree/use-the-force',
          status: 'DECLINED',
          timestamp: pullRequestList[0].updated_at,
          title: pullRequestList[0].title,
          url: 'https://github.com/integrations/test/pull/51',
          updateSequenceId: 12345678,
        },
      ],
      url: 'https://github.com/test-owner/test-repo',
      updateSequenceId: 12345678,
    });
  });

  it('should return no data if there are no issue keys', () => {
    const payload = {
      pull_request: {
        author: null,
        databaseId: 1234568,
        comments: {
          totalCount: 1,
        },
        repository: {
          url: 'https://github.com/test-owner/test-repo',
        },
        baseRef: {
          name: 'master',
        },
        headRef: {
          name: 'test-branch',
        },
        number: 123,
        state: 'MERGED',
        title: 'Test Pull Request title',
        body: '',
        updatedAt: '2018-04-18T15:42:13Z',
        url: 'https://github.com/test-owner/test-repo/pull/123',
      },
      repository: {
        id: 1234568,
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
        owner: { login: 'test-login' },
        html_url: 'https://github.com/test-owner/test-repo',
      },
    };

    Date.now = jest.fn(() => 12345678);

    const { data } = transformPullRequest(payload, payload.pull_request.author);
    expect(data).toBeUndefined();
  });
});
