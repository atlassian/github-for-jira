import Logger, {levelFromName} from 'bunyan';
import bformat from 'bunyan-format';
import filteringStream from '../util/filteringStream'

// add levelInString to include DEBUG | ERROR | INFO | WARN
const formatOut = filteringStream(bformat({outputMode: 'bunyan', levelInString: true}));

const logger = Logger.createLogger(
  {
    name: 'github-for-jira',
    logger: 'config.logger',
    stream: formatOut,
  },
);



const logLevel = process.env.LOG_LEVEL || 'info';
export const globalLoggingLevel = levelFromName[logLevel]

logger.level(globalLoggingLevel);

export const getLogger = (name: string): Logger => {
  return logger.child({logger: name});
}

//Override console.log with bunyan logger.
//we shouldn't use console.log in our code, but it is done to catch
//possible logs from third party libraries
const consoleLogger = getLogger('Console')
// eslint-disable-next-line no-console
console.debug = consoleLogger.debug.bind(consoleLogger);
// eslint-disable-next-line no-console
console.error = consoleLogger.error.bind(consoleLogger);
// eslint-disable-next-line no-console
console.log = consoleLogger.info.bind(consoleLogger);
// eslint-disable-next-line no-console
console.warn = consoleLogger.warn.bind(consoleLogger);



export default logger

