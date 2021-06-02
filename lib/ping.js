const Redis = require('ioredis');

const getRedisInfo = require('./config/redis-info');
const { sequelize } = require('./models');
const logger = require('../config/logger');

/**
 * Create a /_ping endpoint
 *
 * @param {import('probot').Application} robot - The probot app
 */
module.exports = (robot) => {
  const app = robot.route('/');
  const cache = new Redis(getRedisInfo('ping').redisOptions);

  /**
   * /_ping endpoint to checks to see that all our connections are OK
   *
   * It's a race between the setTimeout and our ping + authenticate.
   */
  app.get('/_ping', async (req, res) => {
    let connectionsOk = true;

    try {
      await Promise.race([
        Promise.all([
          cache.ping().catch((_, reject) => {
            reject(new Error('connection'));
          }),
          sequelize.authenticate().catch((_, reject) => {
            reject(new Error('connection'));
          }),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
      ]);
    } catch (err) {
      logger.error(`/_ping: Connection is not ok: ${err}`);
      connectionsOk = false;
    }

    if (connectionsOk) {
      return res.status(200).send('OK');
    } else {
      logger.error('Error attempting to ping Redis and Database');
      return res.status(500).send('NOT OK');
    }
  });
};
