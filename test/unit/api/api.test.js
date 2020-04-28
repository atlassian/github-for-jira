const nock = require('nock');
const supertest = require('supertest');

const successfulAuthResponseWrite = {
  data: {
    viewer: {
      login: 'gimenete',
      isEmployee: true,
      organization: {
        repository: {
          viewerPermission: 'WRITE',
        },
      },
    },
  },
};

const successfulAuthResponseAdmin = {
  data: {
    viewer: {
      login: 'monalisa',
      isEmployee: true,
      organization: {
        repository: {
          viewerPermission: 'ADMIN',
        },
      },
    },
  },
};

const createApp = (locals) => {
  const api = require('../../../lib/api');
  const express = require('express');
  const app = express();
  app.use((req, res, next) => {
    res.locals = locals;
    next();
  });
  app.use('/api', api);
  return app;
};

describe('API', () => {
  describe('Authentication', () => {
    const app = createApp();

    it('should return 404 if no token is provided', () => supertest(app)
      .get('/')
      .set('Authorization', 'Bearer xxx')
      .expect(404)
      .then(response => {
        expect(response.body).toMatchSnapshot();
      }));

    it('should return 200 if a valid token is provided', () => {
      nock('https://api.github.com').post('/graphql').reply(200, successfulAuthResponseWrite);

      return supertest(app)
        .get('/api')
        .set('Authorization', 'Bearer xxx')
        .expect(200)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });

    it('should return 200 if token belongs to an admin', () => {
      nock('https://api.github.com').post('/graphql').reply(200, successfulAuthResponseAdmin);

      return supertest(app)
        .get('/api')
        .set('Authorization', 'Bearer xxx')
        .expect(200)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });

    it('should return 401 if the GraphQL query returns errors', () => {
      nock('https://api.github.com')
        .post('/graphql')
        .reply(200, {
          errors: [
            {
              path: [
                'query',
                'viewer',
                'isEmployeex',
              ],
              extensions: {
                code: 'undefinedField',
                typeName: 'User',
                fieldName: 'isEmployeex',
              },
              locations: [
                {
                  line: 4,
                  column: 5,
                },
              ],
              message: "Field 'isEmployeex' doesn't exist on type 'User'",
            },
          ],
        });

      return supertest(app)
        .get('/api')
        .set('Authorization', 'Bearer xxx')
        .then(response => {
          expect(response.body).toMatchSnapshot();
          expect(response.status).toEqual(401);
        });
    });

    it('should return 401 if the returned organization is null', () => {
      nock('https://api.github.com')
        .post('/graphql')
        .reply(200, {
          data: {
            viewer: {
              login: 'gimenete',
              isEmployee: true,
              organization: null,
            },
          },
        });

      return supertest(app)
        .get('/api')
        .set('Authorization', 'Bearer xxx')
        .expect(401)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        });
    });

    it('should return 401 if the token is invalid', () => {
      nock('https://api.github.com')
        .post('/graphql')
        .reply(401, {
          HttpError: {
            message: 'Bad credentials',
            documentation_url: 'https://developer.github.com/v4',
          },
        });

      return supertest(app)
        .get('/api')
        .set('Authorization', 'Bearer bad token')
        .expect(401)
        .then(response => {
          expect(response.body.HttpError).toMatchSnapshot();
        });
    });

    it('should return 500 if an error happens', () => supertest(app)
      .get('/api')
      .set('Authorization', 'xxx') // malformed header
      .expect(500)
      .then(response => {
        expect(response.body).toMatchSnapshot();
      }));
  });

  describe('Endpoints', () => {
    let models;
    let subject;
    let locals;
    let jiraClient;

    beforeEach(() => {
      nock('https://api.github.com').post('/graphql').reply(200, successfulAuthResponseWrite);

      models = td.replace('../../../lib/models', {
        Subscription: td.object(['getAllForInstallation', 'findOrStartSync']),
        Installation: td.object(['getForHost']),
      });
      locals = {
        client: {
          apps: td.object(),
        },
      };
      jiraClient = {
        devinfo: {
          migration: {
            undo: jest.fn(),
            complete: jest.fn(),
          },
        },
      };
      td.replace('../../../lib/jira/client', () => jiraClient);
      subject = createApp(locals);
    });

    describe('installation', () => {
      it('should return 404 if no installation is found', () => {
        td.when(models.Subscription.getAllForInstallation('unkown-installation-id')).thenReturn([]);

        return supertest(subject)
          .get('/api/unkown-installation-id')
          .set('Authorization', 'Bearer xxx')
          .expect(404)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });

      it('should return information for an existing installation', () => {
        td.when(models.Subscription.getAllForInstallation('1234'))
          .thenReturn([
            {
              dataValues: {
                jiraHost: process.env.ATLASSIAN_URL,
              },
              gitHubInstallationId: 1234,
            },
          ]);

        td.when(locals.client.apps.getInstallation({ installation_id: 1234 }))
          .thenReturn({ data: {} });

        return supertest(subject)
          .get('/api/1234')
          .set('Authorization', 'Bearer xxx')
          .set('host', '127.0.0.1')
          .send('jiraHost=https://test-atlassian-instance.net')
          .expect(200)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });
    });

    describe('repoSyncState', () => {
      it('should return 404 if no installation is found', () => {
        td.when(models.Subscription.getAllForInstallation('unkown-installation-id')).thenReturn([]);

        return supertest(subject)
          .get('/api/unkown-installation-id/repoSyncState.json')
          .set('Authorization', 'Bearer xxx')
          .expect(404)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });

      it('should return the repoSyncState information for an existing installation', () => {
        td.when(models.Subscription.getSingleInstallation(process.env.ATLASSIAN_URL, '1234'))
          .thenReturn(
            {
              dataValues: {
                repoSyncState: { todo: 'more info' },
              },
            },
          );

        td.when(locals.client.apps.getInstallation({ installation_id: 1234 }))
          .thenReturn({ data: {} });

        return supertest(subject)
          .get('/api/1234/repoSyncState.json?jiraHost=https://test-atlassian-instance.net')
          .set('Authorization', 'Bearer xxx')
          .set('host', '127.0.0.1')
          .expect(200)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });
    });

    describe('sync', () => {
      it('should return 404 if no installation is found', () => supertest(subject)
        .post('/api/unkown-installation-id/sync')
        .set('Authorization', 'Bearer xxx')
        .send('jiraHost=unknownhost.atlassian.net')
        .expect(404)
        .then(response => {
          expect(response.text).toMatchSnapshot();
        }));

      it('should trigger the sync or start function', () => {
        td.when(models.Installation.getForHost('me.atlassian.net'))
          .thenReturn([{}]);

        td.when(models.Subscription.getSingleInstallation('me.atlassian.net', '1234'))
          .thenReturn([
            {
              dataValues: {
                repoSyncState: { todo: 'more info' },
              },
            },
          ]);

        models.Subscription.findOrStartSync = jest.fn();

        td.when(locals.client.apps.getInstallation({ installation_id: 1234 }))
          .thenReturn({ data: {} });

        return supertest(subject)
          .post('/api/1234/sync?installationId=1234')
          .set('Authorization', 'Bearer xxx')
          .set('host', '127.0.0.1')
          .send('jiraHost=me.atlassian.net')
          .expect(202)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(models.Subscription.findOrStartSync).toHaveBeenCalled();
          });
      });

      it('should reset repoSyncState if asked to', () => {
        td.when(models.Installation.getForHost('me.atlassian.net'))
          .thenReturn([{}]);

        td.when(models.Subscription.getSingleInstallation('me.atlassian.net', '1234'))
          .thenReturn([
            {
              dataValues: {
                repoSyncState: { todo: 'more info' },
              },
            },
          ]);

        models.Subscription.findOrStartSync = jest.fn();

        td.when(locals.client.apps.getInstallation({ installation_id: 1234 }))
          .thenReturn({ data: {} });

        return supertest(subject)
          .post('/api/1234/sync?installationId=1234')
          .set('Authorization', 'Bearer xxx')
          .set('host', '127.0.0.1')
          .send('jiraHost=me.atlassian.net')
          .send('resetType=full')
          .expect(202)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(models.Subscription.findOrStartSync).toHaveBeenCalledWith([
              {
                dataValues: {
                  repoSyncState: { todo: 'more info' },
                },
              },
            ], 'full');
          });
      });
    });

    describe('undo', () => {
      it('should return 404 if no installation is found', () => supertest(subject)
        .post('/api/unkown-installation-id/migrate/undo')
        .set('Authorization', 'Bearer xxx')
        .send('jiraHost=unknownhost.atlassian.net')
        .expect(404)
        .then(response => {
          expect(response.text).toMatchSnapshot();
        }));

      it('should migrate an installation', () => {
        const update = jest.fn();

        td.when(models.Installation.getForHost('me.atlassian.net'))
          .thenReturn([{}]);

        td.when(models.Subscription.getSingleInstallation('me.atlassian.net', '1234'))
          .thenReturn({ update });

        td.when(locals.client.apps.getInstallation({ installation_id: 1234 }))
          .thenReturn({ data: {} });

        return supertest(subject)
          .post('/api/1234/migrate?installationId=1234')
          .set('Authorization', 'Bearer xxx')
          .set('host', '127.0.0.1')
          .send('jiraHost=me.atlassian.net')
          .expect(200)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(update).toMatchSnapshot();
            expect(jiraClient.devinfo.migration.complete).toHaveBeenCalled();
          });
      });

      it('should undo a migration', () => {
        const update = jest.fn();

        td.when(models.Installation.getForHost('me.atlassian.net'))
          .thenReturn([{}]);

        td.when(models.Subscription.getSingleInstallation('me.atlassian.net', '1234'))
          .thenReturn({ update });

        td.when(locals.client.apps.getInstallation({ installation_id: 1234 }))
          .thenReturn({ data: {} });

        return supertest(subject)
          .post('/api/1234/migrate/undo?installationId=1234')
          .set('Authorization', 'Bearer xxx')
          .set('host', '127.0.0.1')
          .send('jiraHost=me.atlassian.net')
          .expect(200)
          .then(response => {
            expect(response.text).toMatchSnapshot();
            expect(update).toMatchSnapshot();
            expect(jiraClient.devinfo.migration.undo).toHaveBeenCalled();
          });
      });
    });
  });
});
