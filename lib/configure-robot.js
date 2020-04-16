const setupFrontend = require('./frontend');
const setupGitHub = require('./github');
const setupJira = require('./jira');

module.exports = (app) => {
  setupFrontend(app);
  setupGitHub(app);
  setupJira(app);

  return app;
};
