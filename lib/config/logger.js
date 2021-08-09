const pino = require('pino');
const { getTransformStream } = require('@probot/pino');
const { AppInsightsLogger } = require('./app-insights-logger');

function getLog(options = {}) {
  if (process.env.GITHUB_INSTANCE === 'ghae' && process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
    return new AppInsightsLogger();
  } else {
    const { level, logMessageKey, ...getTransformStreamOptions } = options;
    const pinoOptions = {
      level: level || 'info',
      name: 'probot',
      messageKey: logMessageKey || 'msg',
    };
    const transform = getTransformStream(getTransformStreamOptions);

    transform.pipe(pino.destination(1));
    const log = pino(pinoOptions, transform);
    return log;
  }
}
exports.getLog = getLog;
