const transformPullRequest = require('../../../../lib/sync/transforms/pull-request')

describe('pull_request transform', () => {
  it('should send the ghost user to Jira when GitHub user has been deleted', () => {
    const payload = {
      pull_request: {
        author: null, // GraphQL returns `null` when author of PR has been deleted from GitHub
        databaseId: 1234568,
        comments: {
          totalCount: 1
        },
        repository: {
          url: 'https://github.com/test-owner/test-repo'
        },
        baseRef: {
          name: 'master'
        },
        headRef: {
          name: 'test-branch'
        },
        number: 123,
        state: 'MERGED',
        title: 'TES-123 Test Pull Request title',
        body: '',
        updatedAt: '2018-04-18T15:42:13Z',
        url: 'https://github.com/test-owner/test-repo/pull/123'
      },
      repository: {
        id: 1234568,
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
        owner: { login: 'test-login' },
        html_url: 'https://github.com/test-owner/test-repo'
      }
    }

    Date.now = jest.fn(() => 12345678)

    const { data } = transformPullRequest(payload, payload.pull_request.author)
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
            url: 'https://github.com/ghost'
          },
          commentCount: 1,
          destinationBranch: 'https://github.com/test-owner/test-repo/tree/master',
          displayId: '#123',
          id: 123,
          issueKeys: ['TES-123'],
          lastUpdate: '2018-04-18T15:42:13Z',
          sourceBranch: 'test-branch',
          sourceBranchUrl: 'https://github.com/test-owner/test-repo/tree/test-branch',
          status: 'MERGED',
          timestamp: '2018-04-18T15:42:13Z',
          title: 'TES-123 Test Pull Request title',
          url: 'https://github.com/test-owner/test-repo/pull/123',
          updateSequenceId: 12345678
        }
      ],
      url: 'https://github.com/test-owner/test-repo',
      updateSequenceId: 12345678
    })
  })

  it('should return no data if there are no issue keys', () => {
    const payload = {
      pull_request: {
        author: null,
        databaseId: 1234568,
        comments: {
          totalCount: 1
        },
        repository: {
          url: 'https://github.com/test-owner/test-repo'
        },
        baseRef: {
          name: 'master'
        },
        headRef: {
          name: 'test-branch'
        },
        number: 123,
        state: 'MERGED',
        title: 'Test Pull Request title',
        body: '',
        updatedAt: '2018-04-18T15:42:13Z',
        url: 'https://github.com/test-owner/test-repo/pull/123'
      },
      repository: {
        id: 1234568,
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
        owner: { login: 'test-login' },
        html_url: 'https://github.com/test-owner/test-repo'
      }
    }

    Date.now = jest.fn(() => 12345678)

    const { data } = transformPullRequest(payload, payload.pull_request.author)
    expect(data).toBeUndefined()
  })
})
