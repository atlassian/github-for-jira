const { Subscription } = require('../models')

module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('Unauthorized'))
  }

  const subscription = await Subscription.getSingleInstallation(req.query.host, req.query.installationId)
  const { owner, repo } = req.params

  await Subscription.syncRepository(subscription, { owner, repo })

  return res.sendStatus(202)
}
