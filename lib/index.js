const frontend = require('./frontend');
const setupJira = require('./jira');

module.exports = (robot) => {
  // Set up frontend and static files
  const app = robot.route();
  app.use(frontend);

  // Set up Jira webhooks
  setupJira(robot);

  // Set up completed
  robot.log('Yay, the app was loaded!');
};
