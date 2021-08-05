const nock = require('nock');
const { isAdminFunction } = require('../../../lib/frontend/ghae-client-middleware');
const { GitHubAPI } = require('../../../lib/config/github-api');
const jwt = require('atlassian-jwt');

describe('GHAE client middleware', () => {
  describe('Client setup', () => {
    let isAdmin;
    let res;
    let next;
    let ghaeClientMiddleware;
    let app;

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

    const appsecrets = {
      githubHost: 'githubHost',
      clientId: 'a-totally-unique-client-id',
      clientSecret: 'shared-secret',
      privateKey: 'this-is-a-public-key',
      appId: 1,
      webhookSecret: 'webhook-secret',
      getForHost: jest.fn().mockResolvedValue(),
    };

    const installation = {
      id: 19,
      jiraHost: 'jiraHost',
      clientKey: 'abc123',
      enabled: true,
      secrets: 'def234',
      sharedSecret: 'ghi345',
      getForHost: jest.fn().mockResolvedValue(),
    };

    const createApp = (locals) => {
      ghaeClientMiddleware = require('../../../lib/frontend/ghae-client-middleware')();
      const express = require('express');
      const app = express();
      app.use(ghaeClientMiddleware);
      return app;
    };

    beforeAll(() => {
      app = createApp();
    });

    beforeEach(() => {
      res = td.object(['sendStatus']);
      res.locals = {};
      next = td.function('next');
      isAdmin = isAdminFunction(GitHubAPI({
        baseUrl: 'https://test.ghaekube.net/api/v3',
      }));

      const models = td.replace('../../../lib/models');
      td.when(models.Installation.getForHost(installation.jiraHost))
        .thenDo(async () => installation);

      td.when(models.AppSecrets.getForHost(appsecrets.githubHost))
        .thenDo(async () => appsecrets);

      ghaeClientMiddleware = require('../../../lib/frontend/ghae-client-middleware')();
    });

    afterEach(() => {
      td.reset();
    });

    test('When request does not contain jiraHost and githubHost, ghaeInstance details will be empty', async () => {
      const jiraHost = '';
      const githubHost = '';

      const req = buildRequest(jiraHost, githubHost, 'secret');

      await ghaeClientMiddleware(req, res, next);

      expect(installation.getForHost).not.toHaveBeenCalled();
      expect(appsecrets.getForHost).not.toHaveBeenCalled();
    });

    // test('When request contains jiraHost but not githubHost, set githubHost from db, ghaeInstance details will not be empty', async () => {
    //   const jiraHost = 'jiraHost';
    //   const githubHost = '';

    //   const req = buildRequest(jiraHost, githubHost, 'secret');

    //   await ghaeClientMiddleware(req, res, next);

    //   expect(installation.getForHost).toHaveBeenCalled();
    //   expect(appsecrets.getForHost).toHaveBeenCalled();
    // });

    // test('When request contains githubHost but not jiraHost, ghaeInstance details will not be empty', async () => {
    //   const jiraHost = '';
    //   const githubHost = 'githubHost';

    //   const req = buildRequest(jiraHost, githubHost, 'secret');

    //   await ghaeClientMiddleware(req, res, next);

    //   expect(appsecrets.getForHost).toHaveBeenCalled();
    // });

    // test('When request contains githubHost and jiraHost, ghaeInstance details will not be empty', async () => {
    //   const jiraHost = 'jiraHost';
    //   const githubHost = 'githubHost';

    //   const req = buildRequest(jiraHost, githubHost, 'secret');

    //   await ghaeClientMiddleware(req, res, next);
    //   expect(appsecrets.getForHost).toHaveBeenCalled();
    // });
  });


  describe('isAdmin check', () => {
    let isAdmin;
    let res;
    let next;
    beforeEach(() => {
      res = td.object(['sendStatus']);
      res.locals = {};
      next = td.function('next');
      isAdmin = isAdminFunction(GitHubAPI({
        baseUrl: 'https://test.ghaekube.net/api/v3',
      }));
    });

    afterEach(() => {
      td.reset();
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
});
