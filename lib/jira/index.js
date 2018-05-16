const bodyParser = require('body-parser');

const install = require('./install');

module.exports = (robot) => {
  const router = robot.route('/jira');

  // Make robot available
  router.use((req, res, next) => {
    res.locals.robot = robot;
    next();
  });

  router.use(bodyParser.json());

  // Set up event handlers
  router.post('/events/installed', install);
};
