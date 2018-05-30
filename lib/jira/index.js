const bodyParser = require('body-parser')

const connect = require('./connect')
const install = require('./install')

module.exports = (robot) => {
  const router = robot.route('/jira')

  router.use(bodyParser.json())

  router.get('/atlassian-connect.json', connect)

  // Set up event handlers
  router.post('/events/installed', install)
}
