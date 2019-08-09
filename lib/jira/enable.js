const Installation = require('../models/installation')
const getAxiosInstance = require('../jira/client/axios')

module.exports = async (req, res) => {
  const installation = await Installation.getPendingHost(req.body.baseUrl)
  if (installation) {
    res.on('finish', async () => {
      const instance = getAxiosInstance(null, {}, installation.jiraHost, installation.sharedSecret)
      try {
        // Validate the clientKey and the sharedSecret
        // We have to do this after responding with 204 because
        // otherwise we get an error "The add-on is not enabled"
        // no matter what we send
        const result = await instance.get(`/rest/devinfo/0.10/existsByProperties?fakeProperty=1`)
        if (result.status === 200) {
          req.log('App enabled on Jira')
          await installation.enable()
        } else {
          req.log('App not installed. Verification failed.')
        }
      } catch (err) {
        if (err.response.status === 401) {
          req.log('Jira does not recognize this installation. Deleting it.')
          await Installation.uninstall({ clientKey: req.body.clientKey })
        }
      }
    })
    return res.sendStatus(204)
  } else {
    req.log(`No pending installation found for ${req.body.baseUrl}`)
    return res.sendStatus(422)
  }
}
