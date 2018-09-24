const format = require('date-fns/format')
const { Subscription } = require('../models')

async function getInstallation (client, subscription) {
  try {
    return await client.apps.getInstallation({ installation_id: subscription.gitHubInstallationId })
  } catch (err) {
    // if err.code === 404 the installation has been deleted
    return null
  }
}

module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e
  const { client } = res.locals

  const subscriptions = await Subscription.getAllForHost(jiraHost)
  const installations = await Promise.all(subscriptions.map(subscription => getInstallation(client, subscription)))
  const connections = installations
    .filter(Boolean)
    .map(response => response.data)
    .map(data => ({
      ...data,
      isGlobalInstall: data.repository_selection === 'all',
      updated_at: format(data.updated_at, 'MMMM D, YYYY h:mm a')
    }))

  res.render('jira-configuration.hbs', {
    host: req.query.xdm_e,
    connections: connections
  })
}
