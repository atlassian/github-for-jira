const setupFrontend = require('./frontend')
const setupJira = require('./jira')

module.exports = (robot) => {
  setupFrontend(robot)
  setupJira(robot)
}
