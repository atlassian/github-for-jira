import Redis from 'ioredis';
import getRedisInfo from './config/redis-info';
import { sequelize } from './models/sequelize';
import { Application } from 'probot';
import { Response } from 'express';
import bunyan from 'bunyan';

/**
 * Create a /deepcheck and /healthcheck endpoints
 *
 * @param {import('probot').Application} robot - The probot app
 */
export default (robot: Application) => {
  const app = robot.route('/');
  const cache = new Redis(getRedisInfo('ping').redisOptions);

  /**
   * /deepcheck endpoint to checks to see that all our connections are OK
   *
   * It's a race between the setTimeout and our ping + authenticate.
   */
  app.get('/deepcheck', async (_, res: Response) => {
    let connectionsOk = true;
    const deepcheckLogger = bunyan.createLogger({ name: 'deepcheck' });

    try {
      await Promise.race([
        Promise.all([
          cache
            .ping()
            .catch((error) =>
              Promise.reject(
                new Error(`Error issuing PING to redis: ${error}`),
              ),
            ),
          sequelize.authenticate().catch((error) => {
            deepcheckLogger.error(
              `Error issuing authenticate to Sequelize: ${error}`,
            );
            Promise.reject(
              new Error(`Error issuing authenticate to Sequelize: ${error}`),
            );
          }),
        ]),
        new Promise((_, reject) => {
          deepcheckLogger.error(`Error: timeout`);
          setTimeout(() => reject(new Error('timeout')), 500);
        }),
      ]);
    } catch (error) {
      deepcheckLogger.error(`/deepcheck: Connection is not ok: ${err}`);
      connectionsOk = false;
    }

    if (connectionsOk) {
      deepcheckLogger.info('Successfully called /deepcheck');
      return res.status(200).send('OK');
    } else {
      deepcheckLogger.error('Error attempting to ping Redis and Database');
      return res.status(500).send('NOT OK');
    }
  });

  /**
   * /healtcheck endpoint to check that the app started properly
   */
  const healthcheckLogger = bunyan.createLogger({ name: 'healthcheck' });
  app.get('/healthcheck', async (_, res: Response) => {
    res.status(200).send('OK');
    healthcheckLogger.info('Successfully called /healthcheck.');
  });
};
