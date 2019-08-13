const { Installation, Subscription } = require('../models')

module.exports = async (req, res) => {
  const { installation } = res.locals
  const subscriptions = await Subscription.getAllForHost(installation.jiraHost)

  if (subscriptions) {
    await Promise.all(subscriptions.map(async subscription => {
      return subscription.uninstall()
    }))
  }

  req.log(`App uninstalled on Jira. Uninstalling id=${installation.id}.`)

  await Installation.uninstall({
    clientKey: req.body.clientKey
  })

  return res.sendStatus(204)
}
