const setupFrontend = require('./frontend')
const setupGitHub = require('./github')
const setupJira = require('./jira')
const setupSync = require('./sync')

module.exports = (robot) => {
  setupSync(robot)
  setupFrontend(robot)
  setupGitHub(robot)
  setupJira(robot)

  return robot
}
