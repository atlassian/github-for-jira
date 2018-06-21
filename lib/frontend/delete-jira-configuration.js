const { Subscription } = require('../models')

module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e

  await Subscription.uninstall({
    installationId: req.body.installationId,
    host: jiraHost
  })

  res.sendStatus(204)
}
