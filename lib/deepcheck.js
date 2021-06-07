const Redis = require('ioredis');

const getRedisInfo = require('./config/redis-info');
const { sequelize } = require('./models');
const logger = require('../config/logger');

/**
 * Create a /deepcheck and /healthcheck endpoints
 *
 * @param {import('probot').Application} robot - The probot app
 */
module.exports = (robot) => {
  const app = robot.route('/');
  const cache = new Redis(getRedisInfo('ping').redisOptions);

  /**
   * /deepcheck endpoint to checks to see that all our connections are OK
   *
   * It's a race between the setTimeout and our ping + authenticate.
   */
  app.get('/deepcheck', async (req, res) => {
    let connectionsOk = true;

    try {
      await Promise.race([
        Promise.all([
          cache.ping().catch((error) => Promise.reject(new Error(`Error issuing PING to redis: ${error}`))),
          sequelize.authenticate().catch((error) => Promise.reject(new Error(`Error issuing authenticate to Sequelize: ${error}`))),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
      ]);
    } catch (err) {
      logger.error(`/deepcheck: Connection is not ok: ${err}`);
      connectionsOk = false;
    }

    if (connectionsOk) {
      return res.status(200).send('OK');
    } else {
      logger.error('Error attempting to ping Redis and Database');
      return res.status(500).send('NOT OK');
    }
  });

  /**
   * /healtcheck endpoint to check that the app started properly
   */
  app.get('/healthcheck', async (req, res) => res.status(200).send('OK'));
};
