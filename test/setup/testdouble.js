const { createRobot } = require('probot')
const { findPrivateKey } = require('probot/lib/private-key')
const cacheManager = require('cache-manager')
const createGitHubApp = require('probot/lib/github-app')
const configureRobot = require('../../lib/configure-robot')

global.nock = require('nock')
global.td = require('testdouble')

beforeAll(() => {
  require('testdouble-jest')(td, jest)
  require('testdouble-nock')(td, nock)

  nock('https://api.github.com')
    .post(/\/installations\/[\d\w-]+\/access_tokens/)
    .reply(200, {
      token: 'mocked-token',
      expires_at: '9999-12-31T23:59:59Z'
    })

  global.app = configureRobot(createRobot({
    app: createGitHubApp({
      id: 12257,
      cert: findPrivateKey()
    }),
    cache: cacheManager.caching({
      store: 'memory',
      ttl: 60 * 60 // 1 hour
    })
  }))
})

afterEach(() => {
  td.reset()
})
