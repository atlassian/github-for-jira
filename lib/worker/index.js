const Queue = require('bull');
const Sentry = require('@sentry/node');
const Redis = require('ioredis');

const { discovery } = require('../sync/discovery');
const { processInstallation } = require('../sync/installation');
const { processPush } = require('../transforms/push');
const metricsJob = require('./metrics-job');
const statsd = require('../config/statsd');
const getRedisInfo = require('../config/redis-info');
const { getLog } = require('../config/logger');

let logger = getLog();

const { CONCURRENT_WORKERS = 1 } = process.env;
const AxiosErrorEventDecorator = require('../models/axios-error-event-decorator');
const SentryScopeProxy = require('../models/sentry-scope-proxy');
const newrelic = require('newrelic');

const client = new Redis(getRedisInfo('client').redisOptions);
const subscriber = new Redis(getRedisInfo('subscriber').redisOptions);

function measureElapsedTime(startTime, tags) {
  const endTime = new Date();
  const timeDiff = endTime - startTime;
  statsd.histogram('job_duration', timeDiff, tags);
}

/** @type {import('bull').QueueOptions} */
const queueOpts = {
  defaultJobOptions: {
    removeOnComplete: true,
  },
  redis: getRedisInfo('bull').redisOptions,
  createClient: (type, redisOpts = {}) => {
    let redisInfo;
    switch (type) {
      case 'client':
        return client;
      case 'subscriber':
        return subscriber;
      default:
        redisInfo = Object.assign({}, redisOpts);
        redisInfo.connectionName = 'bclient';
        return new Redis(redisInfo);
    }
  },
};

// Setup queues
const queues = {
  discovery: new Queue('Content discovery', queueOpts),
  installation: new Queue('Initial sync', queueOpts),
  push: new Queue('Push transformation', queueOpts),
  metrics: new Queue('Metrics', queueOpts),
};

// Setup error handling for queues
Object.keys(queues).forEach(name => {
  const queue = queues[name];

  queue.on('active', (job, jobPromise) => {
    logger.info(`Job started name=${name} id=${job.id}`);
    job.meta_time_start = new Date();
  });

  queue.on('completed', (job, jobPromise) => {
    logger.info(`Job completed name=${name} id=${job.id}`);
    measureElapsedTime(job.meta_time_start, { queue: name, status: 'completed' });
  });

  queue.on('failed', async (job, err) => {
    logger.error(`Error occurred while processing job id=${job.id} on queue name=${name}`);
    measureElapsedTime(job.meta_time_start, { queue: name, status: 'failed' });
  });

  queue.on('error', (err) => {
    logger.error(`Error occurred while processing queue ${name}: ${err}`);

    Sentry.setTag('queue', name);
    Sentry.captureException(err);
  });
});

/**
 * Return an async function that assigns a Sentry hub to `job.sentry` and sends exceptions.
 */
function sentryMiddleware(jobHandler) {
  return async (job) => {
    job.sentry = new Sentry.Hub(Sentry.getCurrentHub().getClient());
    job.sentry.configureScope(scope => scope.addEventProcessor(AxiosErrorEventDecorator.decorate));
    job.sentry.configureScope(scope => scope.addEventProcessor(SentryScopeProxy.processEvent));

    try {
      await jobHandler(job);
    } catch (err) {
      job.sentry.setExtra('job', {
        id: job.id,
        attemptsMade: job.attemptsMade,
        timestamp: new Date(job.timestamp),
        data: job.data,
      });

      job.sentry.setTag('jiraHost', job.data.jiraHost);
      job.sentry.setTag('queue', job.queue.name);
      job.sentry.captureException(err);

      throw err;
    }
  };
}

/**
 * Return an async function that sends timing data to NewRelic
 */
function newrelicMiddleware(jobHandler) {
  return async (job) => {
    newrelic.startBackgroundTransaction(`job ${job.queue.name}`, 'worker queue', async () => {
      const transaction = newrelic.getTransaction();
      newrelic.addCustomAttributes({
        Queue: job.queue.name,
        'Job Id': job.id,

        // NewRelic wants 'primitive' types. Sending a hash will be dropped
        'Job Arguments': JSON.stringify(job.data),
        'Job Options': JSON.stringify(job.opts),
      });

      try {
        await jobHandler(job);
      } finally {
        transaction.end();
      }
    });
  };
}

/**
 * A common function to wrap all job handlers to include common bits like NewRelic and Sentry
 */
function commonMiddleware(jobHandler) {
  return sentryMiddleware(newrelicMiddleware(jobHandler));
}

module.exports = {
  queues,

  start() {
    queues.discovery.process(5, commonMiddleware(discovery(queues)));
    queues.installation.process(Number(CONCURRENT_WORKERS), commonMiddleware(processInstallation(queues)));
    queues.push.process(Number(CONCURRENT_WORKERS), commonMiddleware(processPush()));
    queues.metrics.process(1, commonMiddleware(metricsJob));

    logger.info(`Worker process started with ${CONCURRENT_WORKERS} CONCURRENT WORKERS`);
  },

  async stop() {
    return Promise.all([
      queues.discovery.close(),
      queues.installation.close(),
      queues.push.close(),
      queues.metrics.close(),
    ]);
  },
};
