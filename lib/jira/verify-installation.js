const Sentry = require('@sentry/node');
const getAxiosInstance = require('../jira/client/axios');

module.exports = (installation, log) => async () => {
  const instance = getAxiosInstance(installation.jiraHost, installation.sharedSecret, log);

  try {
    const result = await instance.get('/rest/devinfo/0.10/existsByProperties?fakeProperty=1');
    if (result.status === 200) {
      log.info(`Installation id=${installation.id} enabled on Jira`);
      installation.enable();
    } else {
      const message = `Unable to verify Jira installation: ${installation.jiraHost} responded with ${result.status}`;
      log.warn(message);
      Sentry.captureMessage(message);
    }
  } catch (err) {
    if (err.response && err.response.status === 401) {
      log.warn(`Jira does not recognize installation id=${installation.id}. Deleting it`);
      installation.destroy();
    } else {
      log.error(`Unhandled error while verifying installation id=${installation.id}: ${err}`);
      Sentry.captureException(err);
    }
  }
};
