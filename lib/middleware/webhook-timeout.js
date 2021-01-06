const DEFAULT_TIMEOUT = Number(process.env.REQUEST_TIMEOUT_MS || 25000);

module.exports = function webhookTimeout(callback, timeout = DEFAULT_TIMEOUT) {
  return async (context) => {
    const timestamp = new Date();
    const id = setTimeout(() => {
      context.timedout = (new Date() - timestamp);
    }, timeout);

    try {
      await callback(context);
    } finally {
      clearTimeout(id);
    }
  };
};
