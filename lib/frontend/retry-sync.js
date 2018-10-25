const { Installation, Subscription } = require('../models')
const jwt = require('atlassian-jwt')

module.exports = async (req, res, next) => {
  const { jiraHost, installationId, token } = req.body

  const installation = await Installation.getForHost(jiraHost)

  if (!installation) {
    next(new Error('Not Found'))
  } else {
    try {
      jwt.decode(token, installation.sharedSecret)

      const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)

      await Subscription.findOrStartSync(subscription)

      return res.sendStatus(202)
    } catch (error) {
      next(new Error('Unauthorized'))
    }
  }
}
