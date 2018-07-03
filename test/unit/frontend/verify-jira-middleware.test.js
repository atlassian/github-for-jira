const jwt = require('atlassian-jwt')

describe('#verifyJiraMiddleware', () => {
  let res
  let next

  let models
  let subject

  beforeEach(() => {
    models = td.replace('../../../lib/models')

    res = td.object(['sendStatus'])
    next = td.function('next')

    subject = require('../../../lib/frontend/verify-jira-middleware')
  })

  it('should call next with a valid token and secret', async () => {
    const encodedJwt = jwt.encode('test-jwt', 'test-secret')
    const req = {
      query: {
        xdm_e: 'test-host',
        jwt: encodedJwt
      }
    }

    td.when(models.Installation.getForHost('test-host'))
      .thenReturn({
        sharedSecret: 'test-secret'
      })

    td.when(jwt.decode(encodedJwt, 'test-secret'))

    await subject(req, res, next)

    td.verify(next())
  })

  it('should return a 404 for an invalid installation', async () => {
    const req = {
      query: {
        xdm_e: 'bad-host'
      }
    }

    td.when(models.Installation.getForHost('bad-host'))
      .thenReturn()

    await subject(req, res, next)

    td.verify(next(td.matchers.contains(new Error('Not Found'))))
  })

  it('should return a 401 for an invalid jwt', async () => {
    const req = {
      query: {
        xdm_e: 'good-host',
        jwt: 'bad-jwt'
      }
    }

    td.when(models.Installation.getForHost('good-host'))
      .thenReturn({
        sharedSecret: 'test-secret'
      })

    await subject(req, res, next)

    td.verify(next(td.matchers.contains(new Error('Unauthorized'))))
  })
})
