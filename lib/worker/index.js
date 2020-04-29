const Queue = require('bull');
const Sentry = require('@sentry/node');

const { discovery } = require('../sync/discovery');
const { processInstallation } = require('../sync/installation');
const { processPush } = require('../transforms/push');
const metricsJob = require('./metrics-job');
const statsd = require('../config/statsd');

const app = require('./app');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const { CONCURRENT_WORKERS = 1 } = process.env;
const AxiosErrorEventDecorator = require('../models/axios-error-event-decorator');
const SentryScopeProxy = require('../models/sentry-scope-proxy');
const newrelic = require('newrelic');

function measureElapsedTime(startTime, tags) {
  const endTime = new Date();
  const timeDiff = endTime - startTime;
  statsd.histogram('job_duration', timeDiff, tags);
}

const queueOpts = { defaultJobOptions: { removeOnComplete: true } };

// Setup queues
const queues = {
  discovery: new Queue('Content discovery', REDIS_URL, queueOpts),
  installation: new Queue('Initial sync', REDIS_URL, queueOpts),
  push: new Queue('Push transformation', REDIS_URL, queueOpts),
  metrics: new Queue('Metrics', REDIS_URL, queueOpts),
};

// Setup error handling for queues
Object.keys(queues).forEach(name => {
  const queue = queues[name];

  queue.on('active', (job, jobPromise) => {
    app.log.info(`Job started name=${name} id=${job.id}`);
    job.meta_time_start = new Date();
  });

  queue.on('completed', (job, jobPromise) => {
    app.log.info(`Job completed name=${name} id=${job.id}`);
    measureElapsedTime(job.meta_time_start, { queue: name, status: 'completed' });
  });

  queue.on('failed', async (job, err) => {
    app.log.error(`Error occurred while processing job id=${job.id} on queue name=${name}`);
    measureElapsedTime(job.meta_time_start, { queue: name, status: 'failed' });
  });

  queue.on('error', (err) => {
    app.log.error(`Error occurred while processing queue ${name}: ${err}`);

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
    queues.discovery.process(5, commonMiddleware(discovery(app, queues)));
    queues.installation.process(Number(CONCURRENT_WORKERS), commonMiddleware(processInstallation(app, queues)));
    queues.push.process(Number(CONCURRENT_WORKERS), commonMiddleware(processPush(app)));
    queues.metrics.process(1, commonMiddleware(metricsJob));

    app.log(`Worker process started with ${CONCURRENT_WORKERS} CONCURRENT WORKERS`);
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
