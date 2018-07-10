const { Subscription } = require('../models')

module.exports = async (req, res) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return res.sendStatus(401)
  }

  if (!req.body.installationId) {
    return res.status(400)
      .json({
        error: 'An Installation ID must be provided to link an installation and a Jira host.'
      })
  }

  await Subscription.install({
    installationId: req.body.installationId,
    host: req.session.jiraHost
  })

  res.sendStatus(200)
}
