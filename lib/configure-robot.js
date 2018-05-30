const setupGitHub = require('./github')
const setupJira = require('./jira')

module.exports = (robot) => {
  setupGitHub(robot)
  setupJira(robot)

  return robot
}
