const Keygrip = require('keygrip');
const supertest = require('supertest');
const nock = require('nock');
const testTracking = require('../../setup/tracking');
const { setIsDisabled } = require('../../../lib/tracking');


describe('Frontend', () => {
  let models;
  let subject;

  beforeEach(() => {
    jest.setTimeout(10000);
    models = td.replace('../../../lib/models');

    subject = require('../../../lib/frontend/app')(app);
  });
  afterEach(() => {
    td.reset();
    setIsDisabled(true);
  });

  describe('GHAE Registration', () => {
    describe('#api', () => {
      it('should return 200 for ghaeRegister', () => supertest(subject)
        .get('/ghaeRegister')
        .send({})
        .expect(200));

      it('should return 400 for register if ghaeHost params missing', () => supertest(subject)
        .post('/register')
        .send({})
        .expect(400));

      it('should return 200 for register', () => supertest(subject)
        .post('/register?ghaeHost=ghaebuild4123test.ghaekube.net')
        .send({})
        .expect(200)
        .then(response => {
          expect(response.body).toMatchSnapshot({
            state: expect.any(String),
          });
        }));

      it('should return 400 for register complete if refer missing in request', () => supertest(subject)
        .get('/ghaeRegisterComplete/?code=12345')
        .send({})
        .expect(400)
        .then(response => {
          expect(response.body.err).toBe('Request not coming from valid referer');
        }));

      it('should return 400 for register complete if code params missing', () => supertest(subject)
        .get('/ghaeRegisterComplete/?code=12345')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(400)
        .then(response => {
          expect(response.body.err).toBe('Missing Auth state parameter');
        }));

      it('should return 400 for register complete if state params missing', () => supertest(subject)
        .get('/ghaeRegisterComplete/?state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(400)
        .then(response => {
          expect(response.body.err).toBe('Missing OAuth Code');
        }));

      it('should return 401 for register complete if invalid state params', () => supertest(subject)
        .get('/ghaeRegisterComplete/?code=12345&state=abc')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(401)
        .then(response => {
          expect(response.body.err).toBe('Invalid Auth state parameter');
        }));

      it('should return 401 for register complete if invalid github host', () => supertest(subject)
        .get('/ghaeRegisterComplete/?code=12345&state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123invalid.ghaekube.net')
        .expect(401)
        .then(response => {
          expect(response.body.err).toBe('Request coming from invalid host');
        }));

      it('should return 400 for register complete if invalid auth code', () => supertest(subject)
        .get('/ghaeRegisterComplete/?code=1234567&state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(400)
        .then(response => {
          expect(response.body.err).toBe('Github Auth code invalidated');
        }));

      it('should return 200 for register complete', () => supertest(subject)
        .get('/ghaeRegisterComplete/?code=12345&state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(200)
        .then(response => {
          expect(response.body).toMatchSnapshot();
        }));
    });
  });
});
