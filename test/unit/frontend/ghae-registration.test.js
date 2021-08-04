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
      it('should return 200 for githubAERegister', () => supertest(subject)
        .get('/githubAERegister')
        .send({})
        .expect(200));


      /*
        Test cases for Register flow, passed ghaeHost parameter.
        Generate state & manifest then call to ghae to register app via manifest flow
      */
      it('should return 400 for register if ghaeHost parameter missing', () => supertest(subject)
        .post('/register')
        .send({})
        .expect(400));

      it('should return 400 for register if invalid ghaeHost parameter', () => supertest(subject)
        .post('/register?ghaeHost=ghaebuild4123test.ghaekube.com')
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


      /*
        Test cases for Register Complete flow, we get callback from ghae with code & state params.
        Validate state, referer & github host then make post call to get app secrets & store in db
      */
      it('should return 400 for register complete if referer missing in request', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=12345')
        .send({})
        .expect(400));

      it('should return 400 for register complete if state params missing', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=12345')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(400));

      it('should return 400 for register complete if code params missing', () => supertest(subject)
        .get('/githubAERegisterComplete/?state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(400));

      it('should return 401 for register complete if invalid state params', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=12345&state=abc')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(401));

      it('should return 401 for register complete if state params older than 1 hour', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=12345&state=abc12345')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(401));

      it('should return 401 for register complete if invalid github host', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=12345&state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123invalid.ghaekube.net')
        .expect(401));

      it('should return 409 for register complete if app already installed on given host', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=12345&state=abc1234')
        .send({})
        .set('referer', 'appinstalled.ghaekube.net')
        .expect(409));

      it('should return 400 for register complete if invalid auth code', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=1234567&state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(400));

      it('should return 200 for register complete', () => supertest(subject)
        .get('/githubAERegisterComplete/?code=12345&state=abc123')
        .send({})
        .set('referer', 'ghaebuild4123test.ghaekube.net')
        .expect(200));
    });
  });
});
