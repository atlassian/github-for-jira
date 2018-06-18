const { Subscription } = require('../models')

module.exports = async (req, res) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return res.sendStatus(401)
  }

  await Subscription.install({
    installationId: parseInt(req.body.installationId, 10),
    host: req.session.jiraHost
  })

  res.sendStatus(200)
}
