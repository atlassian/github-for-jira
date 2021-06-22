import { StatsD, StatsCb, Tags } from 'hot-shots';
import bunyan from 'bunyan';

const globalTags = {
  environment:
    process.env.NODE_ENV === 'test' ? 'test' : process.env.MICROS_ENV,
  environment_type:
    process.env.NODE_ENV === 'test' ? 'testenv' : process.env.MICROS_ENVTYPE,
};

const logger = bunyan.createLogger({ name: 'statsd' });

const statsd = new StatsD({
  prefix: 'github-for-jira.',
  host: 'platform-statsd',
  port: 8125,
  globalTags,
  errorHandler: (err) => logger.warn({ err }, 'error writing metrics'),
  mock: process.env.NODE_ENV === 'test',
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
