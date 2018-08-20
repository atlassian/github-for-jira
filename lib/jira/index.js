const bodyParser = require('body-parser')

const connect = require('./connect')
const disable = require('./disable')
const enable = require('./enable')
const install = require('./install')
const uninstall = require('./uninstall')

module.exports = (robot) => {
  const router = robot.route('/jira')

  router.use(bodyParser.json())

  router.get('/atlassian-connect.json', connect)

  // Set up event handlers
  router.post('/events/disabled', disable)
  router.post('/events/enabled', enable)
  router.post('/events/installed', install)
  router.post('/events/uninstalled', uninstall)
}
