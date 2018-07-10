const Keygrip = require('keygrip')
const supertest = require('supertest')

function getCookieHeader (payload) {
  const cookie = Buffer.from(JSON.stringify(payload)).toString('base64')
  const keygrip = Keygrip([process.env.GITHUB_CLIENT_SECRET])

  return [
    `session=${cookie};session.sig=${keygrip.sign(`session=${cookie}`)};`
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
        await supertest(subject)
          .post('/github/configuration')
          .send({
            installationId: 'test-installation-id'
          })
          .type('form')
          .set('cookie', getCookieHeader({
            githubToken: 'test-github-token',
            jiraHost: 'test-jira-host'
          }))
          .expect(200)

        td.verify(models.Subscription.install({
          installationId: 'test-installation-id',
          host: 'test-jira-host'
        }))
      })
    })
  })
})
