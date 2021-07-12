import Logger  from 'bunyan';
import bformat from 'bunyan-format';
import filteringStream from '../util/filteringStream'

// add levelInString to include DEBUG | ERROR | INFO | WARN
const formatOut = filteringStream(bformat({outputMode: 'bunyan', levelInString: true}));

const logger = Logger.createLogger(
  {
    name: 'github-for-jira',
    loggerName: 'config.logger',
    stream: formatOut,
  },
);

// Suppress logging in tests
if (process.env.NODE_ENV === 'test') {
  logger.level(Logger.FATAL + 1);
}

//Override console.log with bunyan logger.
//we shouldn't use console.log in our code, but it is done to catch
//possible logs from third party libraries
// eslint-disable-next-line no-console
console.debug = logger.debug.bind(logger);
// eslint-disable-next-line no-console
console.error = logger.error.bind(logger);
// eslint-disable-next-line no-console
console.log = logger.info.bind(logger);
// eslint-disable-next-line no-console
console.warn = logger.warn.bind(logger);

export const getLogger = (name: string, params?: Record<string, any>): Logger => {
  params = params || {};
  return logger.child({...params, loggerName: name});
}

export default logger

