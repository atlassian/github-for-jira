import {StatsCb, StatsD, Tags} from 'hot-shots';
import {getLogger} from './logger';
import {NextFunction, Request, Response} from 'express';

const isTest = process.env.NODE_ENV === 'test';

export const globalTags = {
  environment: isTest ? 'test' : process.env.MICROS_ENV,
  environment_type: isTest ? 'testenv' : process.env.MICROS_ENVTYPE,
  deployment_id: process.env.MICROS_DEPLOYMENT_ID || '1',
  region: process.env.MICROS_AWS_REGION || 'localhost',
};

const logger = getLogger('config.statsd');

const statsd = new StatsD({
  prefix: 'github-for-jira.',
  host: 'platform-statsd',
  port: 8125,
  globalTags,
  errorHandler: (err) => {
    if (process.env.NODE_ENV !== 'development') {
      logger.warn(err, 'error writing metrics')
    }
  },

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

export const elapsedTimeMetrics = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const elapsedTimeInMs = hrtimer();
  const {path, method} = req;
  const tags = {path, method};

  res.once('finish', () => {
    statsd.histogram('elapsedTimeInMs', elapsedTimeInMs(), tags);
  });

  next();
};

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
