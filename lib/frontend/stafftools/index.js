const express = require('express')
const format = require('date-fns/format')
const getJiraClient = require('../../jira/client')
const app = express()
const { Installation, Subscription } = require('../../models')
const bodyParser = require('body-parser').urlencoded({ extended: false })

const hbs = require('hbs')
hbs.registerHelper('json', obj => {
  return JSON.stringify(obj)
})

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

app.set('views', __dirname)

app.get('/:installation', async (req, res) => {
  const installationId = req.params.installation
  const { client } = res.locals
  const subscriptions = await Subscription.getAllForInstallation(installationId)
  const { repoSyncState, jiraHost } = subscriptions[0].dataValues
  const installations = await Promise.all(subscriptions.map(subscription => getInstallation(client, subscription)))
  const connections = installations
    .filter(response => !response.error)
    .map(data => ({
      ...data,
      isGlobalInstall: data.repository_selection === 'all',
      updated_at: format(data.updated_at, 'MMMM D, YYYY h:mm a'),
      syncState: data.syncState,
      repoSyncState
    }))
  
  const failedConnections = installations.filter(response => response.error)


  res.render('stafftools.hbs', {
    host: jiraHost,
    installationId,
    title: `Stafftools for ${installationId}`,
    connections,
    failedConnections,
    hasConnections: connections.length > 0 || failedConnections.length > 0,
    APP_URL: process.env.APP_URL
  })
})

app.post('/:installation/:undo?', bodyParser, async (req, res) => {
  const installationId = req.params.installation
  console.log(req.body)
  const { jiraHost } = req.body
  const jiraClient = await getJiraClient(null, installationId, jiraHost)
  const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)

  try {
    if (req.params.undo) {
      await jiraClient.devinfo.migration.undo()
      await subscription.update({ syncStatus: 'FAILED' })
      res.send(`Successfully called migration undo for ${installationId}`)
      return
    } else {
      await jiraClient.devinfo.migration.complete()
      await subscription.update({ syncStatus: 'COMPLETE' })
      res.send(`Successfully called migration complete for ${installationId}`)
      return
    }
  } catch (err) {
    res.send(`Error trying to complete migration for ${installationId}=${err}`)
  }
})

module.exports = app