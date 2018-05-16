const setupJira = require('./jira');

module.exports = (robot) => {
  // Set up Jira webhooks
  setupJira(robot);

  // Set up completed
  robot.log('Yay, the app was loaded!');
};
