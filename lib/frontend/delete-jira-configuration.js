const { Subscription } = require('../models')

module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e

  await Subscription.uninstall({
    installationId: parseInt(req.body.installationId, 10),
    host: jiraHost
  })

  res.sendStatus(204)
}
