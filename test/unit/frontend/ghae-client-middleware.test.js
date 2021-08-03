const nock = require('nock');
const { isAdminFunction } = require('../../../lib/frontend/ghae-client-middleware');
const { GitHubAPI } = require('../../../lib/config/github-api');
const jwt = require('atlassian-jwt');

describe('GHAE client middleware', () => {
  let isAdmin;
  let res;
  let next;

  let models;
  let subject;

  beforeEach(() => {
    models = td.replace('../../../lib/models');

    res = td.object(['sendStatus']);
    res.locals = {};
    next = td.function('next');

    subject = require('../../../lib/frontend/ghae-client-middleware')();
    isAdmin = isAdminFunction(GitHubAPI({
      baseUrl: 'https://test.ghaekube.net/api/v3',
    }));
  });

  afterEach(() => {
    td.reset();
  });

  const buildRequest = (jiraHost, githubHost, secret = 'secret') => {
    const jwtValue = jwt.encode('test-jwt', secret);

    return {
      query: {
        xdm_e: jiraHost,
        jwt: jwtValue,
        githubHost,
      },
      session: {
        githubToken: 'abc-token',
      },
    };
  };

  it('When request does not contain jiraHost and githubHost, ghaeInstance details will be empty', async () => {
    const req = buildRequest('', '', 'secret');
    const models = {
      AppSecrets: {
        getForHost: jest.fn(),
      },
      Installation: {
        getForHost: jest.fn(),
      },
    };

    await subject(req, res, next);

    expect(models.Installation.getForHost).not.toHaveBeenCalled();
    expect(models.AppSecrets.getForHost).not.toHaveBeenCalled();
  });

  it('When request contains jiraHost but not githubHost, set githubHost from db, ghaeInstance details will not be empty', async () => {
    const req = buildRequest('jiraHost', '', 'secret');

    const installation = { jiraHost: 'jiraHost', sharedSecret: 'secret', githubHost: 'githubHost' };
    td.when(models.Installation.getForHost('jiraHost')).thenReturn(installation);

    await subject(req, res, next);

    td.verify(models.AppSecrets.getForHost(installation.githubHost));
  });

  it('When request contains githubHost but not jiraHost, ghaeInstance details will not be empty', async () => {
    const req = buildRequest('', 'githubHost', 'secret');

    await subject(req, res, next);

    td.verify(models.AppSecrets.getForHost('githubHost'));
  });

  it('When request contains githubHost and jiraHost, ghaeInstance details will not be empty', async () => {
    const req = buildRequest('jiraHost', 'githubHost', 'secret');

    await subject(req, res, next);
    td.verify(models.AppSecrets.getForHost('githubHost'));
  });

  it('isAdmin returns true if user is admin of a given organization', async () => {
    nock('https://test.ghaekube.net/api/v3')
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
    nock('https://test.ghaekube.net/api/v3')
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
