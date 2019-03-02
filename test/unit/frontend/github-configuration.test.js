const Keygrip = require('keygrip')
const supertest = require('supertest')
const nock = require('nock')

function getCookieHeader (payload) {
  const cookie = Buffer.from(JSON.stringify(payload)).toString('base64')
  const keygrip = Keygrip([process.env.GITHUB_CLIENT_SECRET])

  return [
    `session=${cookie};session.sig=${keygrip.sign(`session=${cookie}`)};`
  ]
}

const userInstallationsResponse = {
  'total_count': 2,
  'installations': [
    {
      'id': 1
    },
    {
      'id': 3
    }
  ]
}

describe('Frontend', () => {
  let models
  let subject

  beforeEach(() => {
    models = td.replace('../../../lib/models')

    subject = require('../../../lib/frontend/app')(app.app)
  })

  describe('GitHub Configuration', () => {
    describe('#post', () => {
      it('should return a 401 if no GitHub token present in session', () => {
        return supertest(subject)
          .post('/github/configuration')
          .send({})
          .set('cookie', getCookieHeader({
            jiraHost: 'test-jira-host'
          }))
          .expect(401)
      })

      it('should return a 401 if no Jira host present in session', () => {
        return supertest(subject)
          .post('/github/configuration')
          .send({})
          .set('cookie', getCookieHeader({
            githubToken: 'test-github-token'
          }))
          .expect(401)
      })

      it('should return a 401 if the user doesn\'t have access to the requested installation ID', () => {
        nock('https://api.github.com').get('/user/installations').reply(200, userInstallationsResponse)
        return supertest(subject)
          .post('/github/configuration')
          .send({
            installationId: 2
          })
          .type('form')
          .set('cookie', getCookieHeader({
            githubToken: 'test-github-token',
            jiraHost: 'test-jira-host'
          }))
          .expect(401)
      })

      it('should return a 400 if no installationId is present in the body', () => {
        return supertest(subject)
          .post('/github/configuration')
          .send({})
          .set('cookie', getCookieHeader({
            githubToken: 'test-github-token',
            jiraHost: 'test-jira-host'
          }))
          .expect(400)
      })

      it('should return a 200 and install a Subscription', async () => {
        nock('https://api.github.com').get('/user/installations').reply(200, userInstallationsResponse)

        await supertest(subject)
          .post('/github/configuration')
          .send({
            installationId: 1
          })
          .type('form')
          .set('cookie', getCookieHeader({
            githubToken: 'test-github-token',
            jiraHost: 'test-jira-host'
          }))
          .expect(200)

        td.verify(models.Subscription.install({
          installationId: '1',
          host: 'test-jira-host'
        }))
      })
    })
  })
})
