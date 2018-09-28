if (process.env.NEWRELIC_KEY) {
  require('newrelic')
}

const setupFrontend = require('./frontend')
const setupGitHub = require('./github')
const setupJira = require('./jira')

module.exports = (robot) => {
  setupFrontend(robot)
  setupGitHub(robot)
  setupJira(robot)

  return robot
}
