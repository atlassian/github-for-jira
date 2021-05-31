const Sentry = require('@sentry/node');
const getAxiosInstance = require('./client/axios');
const logger = require('../../config/logger');

module.exports = function (installation, log) {
  return async () => {
    const instance = getAxiosInstance(installation.jiraHost, installation.sharedSecret);

    try {
      const result = await instance.get('/rest/devinfo/0.10/existsByProperties?fakeProperty=1');
      if (result.status === 200) {
        logger.info(`Installation id=${installation.id} enabled on Jira`);
        installation.enable();
      } else {
        const message = `Unable to verify Jira installation: ${installation.jiraHost} responded with ${result.status}`;
        logger.warn(message);
        Sentry.captureMessage(message);
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        logger.error(`Jira does not recognize installation id=${installation.id}. Deleting it`);
        installation.destroy();
      } else {
        log.error(`Unhandled error while verifying installation id=${installation.id}: ${err}`);
        Sentry.captureException(err);
      }
    }
  };
};
