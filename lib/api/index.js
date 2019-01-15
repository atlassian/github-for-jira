const express = require('express')
const format = require('date-fns/format')
const getJiraClient = require('../jira/client')
const app = express()
const { Installation, Subscription } = require('../models')
const bodyParser = require('body-parser').urlencoded({ extended: false })
const octokit = require('@octokit/rest')()

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

// All routes require a PAT to belong to someone on staff
// This middleware will take the token and make a request to GraphQL
// to see if it belongs to somone on staff
app.use(async (req, res, next) => {
  const token = req.get('Authorization')
  if (!token) res.sendStatus(404)
  try {
    // Create a separate octokit instance than the one used by the app
    octokit.authenticate({ type: 'token', token: token.split(' ')[1] })
    const { data } = (await octokit.request({
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      // 'viewer' will be the person that owns the token
      query: `{
        viewer {
          login
          isEmployee
        }
      }
      `,
      url: '/graphql'
    })).data

    if (!data.viewer.isEmployee) {
      console.log(`User attempted to access staff routes`)
      console.log(`login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}`)
      return res.sendStatus(401)
    }

    console.log(`Staff routes accessed:`)
    console.log(`login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}`)

    next()
  } catch (err) {
    console.log({err})
    return res.sendStatus(500)
  }
})

app.get('/:installationId', async (req, res) => {
  const { installationId } = req.params
  const { client } = res.locals
  try {
    const subscriptions = await Subscription.getAllForInstallation(installationId)
    if (!subscriptions.length) {
      return res.sendStatus(404)
    }
    const { jiraHost } = subscriptions[0].dataValues
    const installations = await Promise.all(subscriptions.map(subscription => getInstallation(client, subscription)))
    const connections = installations
      .filter(response => !response.error)
      .map(data => ({
        ...data,
        isGlobalInstall: data.repository_selection === 'all',
        updated_at: format(data.updated_at, 'MMMM D, YYYY h:mm a'),
        syncState: data.syncState
      }))

    const failedConnections = installations.filter(response => {
      console.log(response.error)
      return response.error
    })
    res.json({
      host: jiraHost,
      installationId,
      connections,
      failedConnections,
      hasConnections: connections.length > 0 || failedConnections.length > 0,
      repoSyncState: `${req.protocol}://${req.get('host')}/api/${installationId}/repoSyncState.json`
    })
  } catch (err) {
    res.json(err)
  }
})

app.get('/:installationId/repoSyncState.json', async (req, res) => {
  try {
    const subscriptions = await Subscription.getAllForInstallation(req.params.installationId)
    if (!subscriptions.length) {
      return res.sendStatus(404)
    }
    const data = subscriptions[0].dataValues.repoSyncState
    res.json(data)
  } catch (err) {
    res.json(err)
  }
})

app.post('/:installationId/sync', bodyParser, async (req, res) => {
  const { installationId } = req.params
  const { jiraHost } = req.body

  const installation = await Installation.getForHost(jiraHost)

  if (!installation) {
    res.sendStatus(404)
  } else {
    try {
      const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
      if (!subscription) {
        return res.sendStatus(404)
      }

      await Subscription.findOrStartSync(subscription)

      res.json({
        message: `Successfully (re)started sync for ${installationId}`
      }).status(202)
    } catch (err) {
      console.log(err)
      res.sendStatus(401)
    }
  }
})

app.post('/:installationId/migrate/:undo?', bodyParser, async (req, res) => {
  const { installationId } = req.params
  const { jiraHost } = req.body
  const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)

  if (!subscription) {
    return res.sendStatus(404)
  }

  const jiraClient = await getJiraClient(null, installationId, jiraHost)

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
    res.send(`Error trying to complete migration for ${installationId}=${err}`).status(500)
  }
})

module.exports = app
