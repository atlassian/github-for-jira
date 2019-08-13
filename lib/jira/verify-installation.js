const getAxiosInstance = require('../jira/client/axios')
const { Sentry } = require('../error-handler')

module.exports = function (installation, log) {
  return async () => {
    const instance = getAxiosInstance(null, {}, installation.jiraHost, installation.sharedSecret)

    try {
      const result = await instance.get(`/rest/devinfo/0.10/existsByProperties?fakeProperty=1`)
      if (result.status === 200) {
        log(`Installation id=${installation.id} enabled on Jira`)
        installation.enable()
      } else {
        const message = `Unable to verify Jira installation: ${installation.jiraHost} responded with ${result.status}`
        log(message)
        Sentry.captureMessage(message)
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        log(`Jira does not recognize installation id=${installation.id}. Deleting it`)
        installation.destroy()
      } else {
        log(`Unhandled error while verifying installation id=${installation.id}: ${err}`)
        Sentry.captureException(err)
      }
    }
  }
}
