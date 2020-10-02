const setupFrontend = require('./frontend');
const setupGitHub = require('./github');
const setupJira = require('./jira');
const setupPing = require('./ping');

/**
 *
 * @param {import('probot').Application} app - The probot application
 */
module.exports = (app) => {
  setupFrontend(app);
  setupGitHub(app);
  setupJira(app);
  setupPing(app);

  return app;
};
