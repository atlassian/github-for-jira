const { Subscription } = require('../models')

module.exports = async (req, res) => {
  const { installation } = res.locals
  const subscriptions = await Subscription.getAllForHost(installation.jiraHost)

  if (subscriptions) {
    await Promise.all(subscriptions.map(async subscription => subscription.uninstall()))
  }

  await installation.uninstall()

  req.log(`App uninstalled on Jira. Uninstalling id=${installation.id}.`)

  return res.sendStatus(204)
}
