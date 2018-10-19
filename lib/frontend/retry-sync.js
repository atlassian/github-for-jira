const { Subscription } = require('../models')

module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('Unauthorized'))
  }

  const subscription = await Subscription.getSingleInstallation(req.body.host, req.body.installationId)

  await Subscription.findOrStartSync(subscription)

  return res.sendStatus(202)
}
