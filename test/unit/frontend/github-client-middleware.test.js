const nock = require('nock');
const { isAdminFunction } = require('../../../src/frontend/github-client-middleware');
const { GitHubAPI } = require('../../../src/config/github-api');

describe('GitHub client middleware', () => {
  let isAdmin;

  beforeEach(() => {
    isAdmin = isAdminFunction(GitHubAPI());
  });

  it('isAdmin returns true if user is admin of a given organization', async () => {
    nock('https://api.github.com')
      .get('/orgs/test-org/memberships/test-user')
      .reply(200, { role: 'admin' });

    const result = await isAdmin({
      org: 'test-org',
      username: 'test-user',
      type: 'Organization',
    });

    expect(result).toBe(true);
  });

  it('isAdmin returns false if user is not an admin of a given organization', async () => {
    nock('https://api.github.com')
      .get('/orgs/test-org/memberships/test-user')
      .reply(200, { role: 'member' });

    const result = await isAdmin({
      org: 'test-org',
      username: 'test-user',
      type: 'Organization',
    });

    expect(result).toBe(false);
  });

  it('isAdmin returns true if repo is owned by a given user', async () => {
    const result = await isAdmin({
      org: 'test-user',
      username: 'test-user',
      type: 'User',
    });

    expect(result).toBe(true);
  });

  it('isAdmin returns false if repo is owned by another user', async () => {
    const result = await isAdmin({
      org: 'different-user',
      username: 'test-user',
      type: 'User',
    });

    expect(result).toBe(false);
  });
});
