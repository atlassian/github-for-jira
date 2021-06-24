import { StatsD, StatsCb, Tags } from 'hot-shots';
import bunyan from 'bunyan';
import { Request, Response, NextFunction } from 'express';

const isTest = process.env.NODE_ENV === 'test';

export const globalTags = {
  environment: isTest ? 'test' : process.env.MICROS_ENV,
  environment_type: isTest ? 'testenv' : process.env.MICROS_ENVTYPE,
  deployment_id: process.env.MICROS_DEPLOYMENT_ID || '1',
  region: process.env.MICROS_AWS_REGION || 'localhost',
};

const logger = bunyan.createLogger({ name: 'statsd' });

const statsd = new StatsD({
  prefix: 'github-for-jira.',
  host: 'platform-statsd',
  port: 8125,
  globalTags,
  errorHandler: (err) => logger.warn({ err }, 'error writing metrics'),
  mock: isTest,
});

/**
 * High-resolution timer
 *
 * @returns {function(): number} A function to call to get the duration since this function was created
 */
function hrtimer() {
  const start = process.hrtime();

  return () => {
    const durationComponents = process.hrtime(start);
    const seconds = durationComponents[0];
    const nanoseconds = durationComponents[1];
    return seconds * 1000 + nanoseconds / 1e6;
  };
}

interface StatsdRequest extends Request {
  statsdKey: string;
  statsdTags: string[];
}

export const expressStatsdMetrics = (path: string) => {
  const expressStatsdLogger = bunyan.createLogger({ name: 'elapsedTimeInMs' });
  expressStatsdLogger.info('before finishing');
  const elapsedTimeInMs = hrtimer();

  return function (req: StatsdRequest, res: Response, next: NextFunction) {
    const method = req.method || 'unknown_method';
    req.statsdKey = ['http', method.toLowerCase(), path].join('.');

    res.on('finish', () => {
      expressStatsdLogger.info('%s : %fms', req.path, elapsedTimeInMs);

      req.statsdTags = [`elapsedTimeInMs: ${elapsedTimeInMs}`];
    });

    expressStatsdLogger.info('after finishing');
    next();
  };
};

// import {Request, Response, NextFunction} from 'express';
// import bunyan from 'bunyan';

// export const logResponseTime = (req: Request, res: Response, next: NextFunction) => {
//   const logger = bunyan.createLogger({ name: 'Log response time' });
//   const startHrTime = process.hrtime();

//   res.on("finish", () => {
//     const elapsedHrTime = process.hrtime(startHrTime);
//     const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
//     logger.info("%s : %fms", req.path, elapsedTimeInMs);
//   });

//   next();
// }

/**
 * Async Function Timer using Distributions
 */
export function asyncDistTimer(
  func: (...args: never[]) => Promise<unknown>,
  stat: string | string[],
  sampleRate?: number,
  tags?: Tags,
  callback?: StatsCb,
) {
  return (...args: never[]): Promise<unknown> => {
    const end = hrtimer();
    const p = func(...args);
    const recordStat = () =>
      statsd.distribution(stat, end(), sampleRate, tags, callback);
    p.then(recordStat, recordStat);
    return p;
  };
}

export default statsd;
