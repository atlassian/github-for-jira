const { Installation, Subscription } = require('../models')
const getJiraClient = require('../jira/client')

module.exports = async (req, res) => {
  req.log('App uninstalled on Jira. Removing secrets.')

  const installation = await Installation.getForClientKey(req.body.clientKey)

  if (!installation) {
    return res.sendStatus(404)
  }
  const jiraClient = await getJiraClient(null, null, installation.jiraHost)

  const subscriptions = await Subscription.getAllForHost(installation.jiraHost)

  if (subscriptions) {
    await Promise.all(subscriptions.map(subscription => subscription.uninstall()))
  }

  await Installation.uninstall({
    clientKey: req.body.clientKey
  })

  await jiraClient.devinfo.migration.undo()

  return res.sendStatus(204)
}
