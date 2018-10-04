const bodyParser = require('body-parser')

const { Installation } = require('../models')
const { hasValidJwt } = require('./util/jwt')

const connect = require('./connect')
const disable = require('./disable')
const enable = require('./enable')
const install = require('./install')
const uninstall = require('./uninstall')

module.exports = (robot) => {
  const router = robot.route('/jira')

  router.use(bodyParser.json())

  router.get('/atlassian-connect.json', connect)

  const authenticate = async (req, res, next) => {
    const installation = await Installation.getForClientKey(req.body.clientKey)
    if (!installation) {
      res.status(404).json({})
      return
    }
    res.locals.installation = installation
    const { jiraHost: baseUrl } = installation
    if (!hasValidJwt(installation.sharedSecret, baseUrl, req, res)) return
    next()
  }

  // Set up event handlers
  router.post('/events/disabled', authenticate, disable)
  router.post('/events/enabled', authenticate, enable)
  router.post('/events/installed', install) // we can't authenticate since we don't have the secret
  router.post('/events/uninstalled', authenticate, uninstall)
}
