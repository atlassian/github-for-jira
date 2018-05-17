const bodyParser = require('body-parser')

const install = require('./install')

module.exports = (robot) => {
  const router = robot.route('/jira')

  router.use(bodyParser.json())

  // Set up event handlers
  router.post('/events/installed', install)
}
