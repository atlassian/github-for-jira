import { StatsD, StatsCb, Tags } from 'hot-shots';
import bunyan from 'bunyan';

const get = (key: string, def?: string): string => {
  const value = process.env[key] || def;
  if (typeof value !== 'string') {
    throw new Error(`config value ${key} not found`);
  }
  return value;
};

export const config = {
  micros: {
    // micros env vars are documented here https://hello.atlassian.net/wiki/spaces/MICROS/pages/167212650/Runtime+configuration+environment+variables+and+adding+secrets
    environment: get('MICROS_ENV', ''),
    environmentType: get('MICROS_ENVTYPE', ''),
  },

  statsd: {
    host: get('STATSD_HOST', 'platform-statsd'),
    port: get('STATSD_PORT', '8125'),
  },
};

const globalTags = {
  environment: config.micros.environment,
  environment_type: config.micros.environmentType,
};

const logger = bunyan.createLogger({ name: 'statsd' });

const statsd = new StatsD({
  prefix: 'github-for-jira.',
  host: config.statsd.host,
  port: parseInt(config.statsd.port),
  globalTags,
  errorHandler: (err) => logger.warn({ err }, 'error writing metrics'),
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
