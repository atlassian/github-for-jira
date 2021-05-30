const bunyan = require('bunyan');
const bformat = require('bunyan-format');
// add levelInString to include DEBUG | ERROR | INFO | WARN
const formatOut = bformat({ outputMode: 'bunyan', levelInString: true });

const logger = bunyan.createLogger(
  {
    name: 'github-for-jira',
    stream: formatOut,
    level: 'info',
  },
);

console.debug = logger.debug.bind(logger);
console.error = logger.error.bind(logger);
console.log = logger.info.bind(logger);
console.warn = logger.warn.bind(logger);

module.exports = { logger };
