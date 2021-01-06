const jwt = require('atlassian-jwt');

describe('#verifyJiraMiddleware', () => {
  let res;
  let next;

  let models;
  let subject;

  beforeEach(() => {
    models = td.replace('../../../lib/models');

    res = td.object(['sendStatus']);
    res.locals = {};
    next = td.function('next');

    subject = require('../../../lib/frontend/verify-jira-middleware');
  });

  afterEach(() => {
    td.reset();
  });

  describe('GET request', () => {
    const buildRequest = (jiraHost, secret = 'secret') => {
      const jwtValue = jwt.encode('test-jwt', secret);

      return {
        query: {
          xdm_e: jiraHost,
          jwt: jwtValue,
        },
        addLogFields: () => { },
      };
    };

    it('should call next with a valid token and secret', async () => {
      const req = buildRequest('test-host', 'secret');

      td.when(models.Installation.getForHost('test-host'))
        .thenReturn({
          jiraHost: 'test-host',
          sharedSecret: 'secret',
        });

      td.when(jwt.decode(req.query.jwt, 'secret'));

      await subject(req, res, next);

      td.verify(next());
    });

    it('sets res.locals to installation', async () => {
      const req = buildRequest('host', 'secret');

      const installation = { jiraHost: 'host', sharedSecret: 'secret' };
      td.when(models.Installation.getForHost('host')).thenReturn(installation);
      td.when(jwt.decode(req.query.jwt, 'secret'));

      await subject(req, res, next);

      expect(res.locals.installation).toEqual(installation);
    });

    it('should return a 404 for an invalid installation', async () => {
      const req = buildRequest('host');

      td.when(models.Installation.getForHost('host')).thenReturn();

      await subject(req, res, next);

      td.verify(next(td.matchers.contains(new Error('Not Found'))));
    });

    it('should return a 401 for an invalid jwt', async () => {
      const req = buildRequest('good-host', 'wrong-secret');

      td.when(models.Installation.getForHost('good-host'))
        .thenReturn({
          jiraHost: 'good-host',
          sharedSecret: 'secret',
        });

      await subject(req, res, next);

      td.verify(next(td.matchers.contains(new Error('Unauthorized'))));
    });

    it('adds installation details to log', async () => {
      const req = buildRequest('host', 'secret');
      const addLogFieldsSpy = jest.spyOn(req, 'addLogFields');

      const installation = { jiraHost: 'host', sharedSecret: 'secret', clientKey: 'abcdef' };
      td.when(models.Installation.getForHost('host')).thenReturn(installation);
      td.when(jwt.decode(req.query.jwt, 'secret'));

      await subject(req, res, next);

      expect(addLogFieldsSpy).toHaveBeenCalledWith({
        jiraHost: installation.jiraHost,
        jiraClientKey: installation.clientKey,
      });
    });
  });

  describe('POST request', () => {
    const buildRequest = (jiraHost, secret) => {
      const encodedJwt = secret && jwt.encode('test-jwt', secret);

      return {
        body: {
          jiraHost,
          token: encodedJwt,
        },
        addLogFields: () => { },
      };
    };

    it('pulls jiraHost and token from body', async () => {
      const req = buildRequest('host', 'secret');
      const installation = { jiraHost: 'host', sharedSecret: 'secret' };

      td.when(models.Installation.getForHost('host')).thenReturn(installation);
      td.when(jwt.decode(req.body.token, 'secret'));

      await subject(req, res, next);

      td.verify(next());
    });

    it('is not found when host is missing', async () => {
      const req = buildRequest('host');

      td.when(models.Installation.getForHost('host')).thenReturn();

      await subject(req, res, next);

      td.verify(next(td.matchers.contains(new Error('Not Found'))));
    });

    it('is unauthorized when token missing', async () => {
      const req = buildRequest('host');
      const installation = { jiraHost: 'host', sharedSecret: 'secret' };

      td.when(models.Installation.getForHost('host')).thenReturn(installation);

      await subject(req, res, next);

      td.verify(next(td.matchers.contains(new Error('Unauthorized'))));
    });
  });
});
