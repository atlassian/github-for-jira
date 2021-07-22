const supertest = require('supertest');
const { isMaintenanceMode } = require('../../../lib/config/env');

describe('Maintenance', () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = 'true';
  });

  describe('Environment', () => {
    it('should return `true` if Maintenance Mode is "true"', () => {
      expect(isMaintenanceMode()).toBeTrue();
    });

    it('should return `false` if Maintenance Mode is "false", not set, undefined, or any other string', () => {
      process.env.MAINTENANCE_MODE = 'false';
      expect(isMaintenanceMode()).toBeFalse();
      delete process.env.MAINTENANCE_MODE;
      expect(isMaintenanceMode()).toBeFalse();
      process.env.MAINTENANCE_MODE = undefined;
      expect(isMaintenanceMode()).toBeFalse();
      process.env.MAINTENANCE_MODE = '';
      expect(isMaintenanceMode()).toBeFalse();
      process.env.MAINTENANCE_MODE = 'foobar';
      expect(isMaintenanceMode()).toBeFalse();
    });
  });

  describe('Ping', () => {
    it('should still work in maintenance mode', () =>
      supertest(app.router)
        .get('/_ping')
        .expect(200));
  });

  describe('Github', () => {
  });

  describe('Frontend', () => {
    describe('Jira', () => {
      it('should return a non 200 status code when in maintenance mode', () =>
        supertest(app.router)
          .get('/jira/atlassian-connect.json')
          .then(response => {
            expect(response.status).not.toBe(200);
          }));

      it('should return a 200 status code when not in maintenance mode', () => {
        delete process.env.MAINTENANCE_MODE;
        return supertest(app.router)
          .get('/jira/atlassian-connect.json')
          .expect(200);
      });
    });

    describe('Admin API', () => {
      beforeEach(() => {
        nock('https://api.github.com')
          .post('/graphql')
          .reply(200, {
            data: {
              viewer: {
                login: 'monalisa',
                organization: {
                  repository: {
                    viewerPermission: 'ADMIN',
                  },
                },
              },
            },
          });
      });
      it('should still work in maintenance mode', () =>
        supertest(app.router)
          .get('/api')
          .set('Authorization', 'Bearer xxx')
          .expect(200));
    });

    describe('Maintenance', () => {
      it('should return maintenance page on "/maintenance" even if maintenance mode is off', () => {
        delete process.env.MAINTENANCE_MODE;
        return supertest(app.router)
          .get('/maintenance')
          .expect(503)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          });
      });

      it('should return 503 for any frontend routes', () =>
        supertest(app.router)
          .get('/jira/atlassian-connect.json')
          .expect(503)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          }));

      it('should return expected page when maintenance mode is off', () => {
        delete process.env.MAINTENANCE_MODE;
        return supertest(app.router)
          .get('/jira/atlassian-connect.json')
          .expect(200).then(response => {
            // removing keys that changes for every test run
            delete response.body.baseUrl;
            delete response.body.name;
            delete response.body.key;
            expect(response.body).toMatchSnapshot();
          });
      });

      it('should still be able to get static assets in maintenance mode', () =>
        supertest(app.router)
          .get('/public/maintenance.svg')
          .set('Accept', 'image/svg+xml')
          .expect('Content-Type', 'image/svg+xml')
          .expect(200)
          .then(response => {
            expect(response.body).toMatchSnapshot();
          }));
    });
  });
});
