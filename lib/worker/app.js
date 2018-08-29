// FIXME: This is all a bit of a hack to get access to a Probot Application
//        instance, mainly to use the `auth()` method. Probot needs refactored
//        so that method is more easily accessible.

const { createProbot } = require('probot')
const { findPrivateKey } = require('probot/lib/private-key')

const probot = createProbot({
  id: process.env.APP_ID,
  cert: findPrivateKey(),

  // These aren't needed by worker process
  secret: undefined,
  port: undefined,
  webhookPath: undefined,
  webhookProxy: undefined
})

// Load an empty app so we can get access to probot's auth handling
const app = probot.load(() => {})

module.exports = app
