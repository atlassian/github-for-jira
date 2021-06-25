import './config/env'; // Important to be before other dependencies
import initializeSentry from './config/sentry';
import throng from 'throng';
import getRedisInfo from './config/redis-info';
import * as PrivateKey from 'probot/lib/private-key';
import { createProbot } from 'probot';
import App from './configure-robot';
import bunyan from 'bunyan';
import { exec } from 'child_process';

const isProd = process.env.NODE_ENV === 'production';
const { redisOptions } = getRedisInfo('probot');
initializeSentry();

const probot = createProbot({
  id: Number(process.env.APP_ID),
  secret: process.env.WEBHOOK_SECRET,
  cert: PrivateKey.findPrivateKey(),
  port: Number(process.env.TUNNEL_PORT) || Number(process.env.PORT) || 8080,
  webhookPath: '/github/events',
  webhookProxy: process.env.WEBHOOK_PROXY_URL,
  redisConfig: redisOptions,
});

async function createDBTables(logger: bunyan) {
  try {
    await new Promise<void>((resolve, reject) => {
      const migrate = exec(
        'node_modules/.bin/sequelize db:migrate',
        { env: process.env },
        (err) => (err ? reject(err) : resolve()),
      );

      // Forward stdout+stderr to this process
      migrate.stdout.pipe(process.stdout);
      migrate.stderr.pipe(process.stderr);
    });
  } catch (e) {
    logger.error(`Error creating tables: ${e}`);
  }
}

/**
 * Start the probot worker.
 */
async function start() {
  const logger = bunyan.createLogger({ name: 'App start' });

  // Create tables for micros environments
  if (isProd) await createDBTables(logger);

  // We are always behind a proxy, but we want the source IP
  probot.server.set('trust proxy', true);
  probot.load(App);

  probot.start();
}

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (isProd) {
  // Start clustered server
  throng(
    {
      lifetime: Infinity,
    },
    start,
  );
} else {
  start();
}
