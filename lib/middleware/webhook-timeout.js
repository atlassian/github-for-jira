const logger = require('../../config/logger');

const DEFAULT_TIMEOUT = Number(process.env.REQUEST_TIMEOUT_MS || 25000);

module.exports = function webhookTimeout(callback, timeout = DEFAULT_TIMEOUT) {
  return async (context) => {
    const timestamp = new Date();
    const id = setTimeout(() => {
      context.timedout = (new Date() - timestamp);
    }, timeout);

    try {
      await callback(context);
    } catch (err) {
      // clearTimeout(id);
      logger.error(`webhookTimeout error: ${err}`);
      throw new Error(err);
    } finally {
      clearTimeout(id);
    }
  };
};
