/*
 * Fills in for a logger, storing messages locally for easy assertions
 *
 * logger = new LogDouble()
 * somethingThatLogs(logger)
 * expect(logger.infoValues).toEqual([
 *   { metadata: { foo: 'bar' }, message: 'Hello world' }
 * ])
 */
export default class LogDouble {
  debugValues = [];
  infoValues = [];
  warnValues = [];
  errorValues = [];

  debug(metadata, message) {
    this.debugValues.push({ metadata, message });
  }

  info(metadata, message) {
    this.infoValues.push({ metadata, message });
  }

  warn(metadata, message) {
    this.warnValues.push({ metadata, message });
  }

  error(metadata, message) {
    this.errorValues.push({ metadata, message });
  }
}
