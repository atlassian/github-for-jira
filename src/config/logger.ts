import Logger  from 'bunyan';;
import bformat from 'bunyan-format';

// add levelInString to include DEBUG | ERROR | INFO | WARN
const formatOut = bformat({outputMode: 'bunyan', levelInString: true});

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

console.debug = logger.debug.bind(logger);
console.error = logger.error.bind(logger);
console.log = logger.info.bind(logger);
console.warn = logger.warn.bind(logger);

export const getLogger = (name: string, params?: Record<string, any>): Logger => {
  params = params || {};
  return logger.child({...params, loggerName: name});
}

export default logger

