import Redis from 'ioredis';
import getRedisInfo from './config/redis-info';
import {sequelize} from './models/sequelize';
import {Application} from 'probot';

/**
 * Create a /_ping endpoint
 */
export default (robot: Application) => {
  const app = robot.route('/');
  const cache = new Redis(getRedisInfo('ping').redisOptions);

  /**
   * /_ping endpoint to checks to see that all our connections are OK
   *
   * It's a race between the setTimeout and our ping + authenticate.
   */
  // TODO: is this endpoint even called?
  app.get('/_ping', async (req, res) => {
    let connectionsOk = true;
    try {
      await Promise.race([
        Promise.all([
          cache.ping().catch(() => {
            req.log.error('Error issuing PING to redis');
            return Promise.reject(new Error('connection'));
          }),
          sequelize.authenticate().catch(() => {
            req.log.error('Error issuing authenticate to Sequelize');
            return Promise.reject(new Error('connection'));
          }),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
      ]);
    } catch (err) {
      connectionsOk = false;
    }

    if (connectionsOk) {
      return res.status(200).send('OK');
    }
    req.log.error('Error attempting to ping Redis and Database');
    return res.status(500).send('NOT OK');
  });
};
