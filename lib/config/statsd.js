const process = require('process');
const StatsD = require('hot-shots');

/** @type {import('hot-shots').StatsD} */
const statsd = new StatsD({
  prefix: 'jira-integration.',
  mock: process.env.NODE_ENV === 'test',
  globalTags: { env: process.env.NODE_ENV || 'unknown' },
});

/**
 * High-resolution timer
 *
 * @returns {function(): number} A function to call to get the duration since this function was created
 */
function hrtimer() {
  const start = process.hrtime();

  /**
   * hrtimer internal function
   *
   * @returns {number} The time since this callback was created
   */
  const inner = () => {
    const durationComponents = process.hrtime(start);
    const seconds = durationComponents[0];
    const nanoseconds = durationComponents[1];
    const duration = (seconds * 1000) + (nanoseconds / 1E6);
    return duration;
  };
  return inner;
}

/**
 * Async Function Timer using Distributions
 *
 * @param {Function} func - The function to time
 * @param {string|Array<string>} stat - The stat name to record
 * @param {number} [sampleRate] - The Rate to sample the metric
 * @param {Array<string>} [tags] - Tags to add to the metric
 * @param {import('hot-shots').StatsCb} [callback] - A callback when the function is complete
 * @returns {Function} A function that you can call with your normal args that times your original function
 */
function asyncDistTimer(func, stat, sampleRate, tags, callback) {
  return (...args) => {
    const end = hrtimer();
    const p = func(...args);
    const recordStat = () => statsd.distribution(stat, end(), sampleRate, tags, callback);
    p.then(recordStat, recordStat);
    return p;
  };
}
module.exports = statsd;
module.exports.asyncDistTimer = asyncDistTimer;
