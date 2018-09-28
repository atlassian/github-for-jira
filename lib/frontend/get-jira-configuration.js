const format = require('date-fns/format')
const { Subscription } = require('../models')

async function getInstallation (client, subscription) {
  const id = subscription.gitHubInstallationId
  try {
    const response = await client.apps.getInstallation({ installation_id: id })
    response.data.syncStatus = subscription.syncStatus
    return response.data
  } catch (err) {
    return { error: err, id, deleted: err.code === 404 }
  }
}

module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e
  const { client } = res.locals

  const subscriptions = await Subscription.getAllForHost(jiraHost)
  const installations = await Promise.all(subscriptions.map(subscription => getInstallation(client, subscription)))
  const connections = installations
    .filter(response => !response.error)
    .map(data => ({
      ...data,
      isGlobalInstall: data.repository_selection === 'all',
      updated_at: format(data.updated_at, 'MMMM D, YYYY h:mm a'),
      syncState: data.syncState
    }))
  const failedConnections = installations.filter(response => response.error)

  res.render('jira-configuration.hbs', {
    host: req.query.xdm_e,
    connections,
    failedConnections,
    hasConnections: connections.length > 0 || failedConnections.length > 0
  })
}
