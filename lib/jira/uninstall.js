const { Installation, Subscription } = require('../models')

module.exports = async (req, res) => {
  req.log('App uninstalled on Jira. Removing secrets.')

  const installation = await Installation.getForClientKey(req.body.clientKey)

  if (!installation) {
    return res.sendStatus(404)
  }

  const subscriptions = await Subscription.getAllForHost(installation.jiraHost)

  if (subscriptions) {
    await Promise.all(subscriptions.map(async subscription => {
      return subscription.uninstall()
    }))
  }

  await Installation.uninstall({
    clientKey: req.body.clientKey
  })

  return res.sendStatus(204)
}
