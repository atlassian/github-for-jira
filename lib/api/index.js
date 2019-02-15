const express = require('express')
const format = require('date-fns/format')
const app = express()
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

const viewerPermissionQuery = `{
  viewer {
    login
    isEmployee
    organization(login: "github") {
      repository(name: "ecosystem-primitives") {
        viewerPermission
      }
    }
  }
}
`
// All routes require a PAT to belong to someone on staff
// This middleware will take the token and make a request to GraphQL
// to see if it belongs to somone on staff
app.use(async (req, res, next) => {
  const token = req.get('Authorization')
  if (!token) return res.sendStatus(404)
  try {
    // Create a separate octokit instance than the one used by the app
    octokit.authenticate({ type: 'token', token: token.split(' ')[1] })
    const { data, errors } = (await octokit.request({
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST',
      // 'viewer' will be the person that owns the token
      query: viewerPermissionQuery,
      url: '/graphql'
    })).data

    if (errors) {
      res.status(401)
      return res.json({ errors, viewerPermissionQuery })
    }

    if (!data.viewer.organization) {
      console.log(`Non-github scoped token attempted to access staff routes`)
      console.log(`login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}`)
      res.status(401)
      return res.json({
        error: 'Unauthorized',
        message: 'Token provided does not have access to the `github` organization'
      })
    }

    if (data.viewer.organization.repository.viewerPermission !== 'WRITE') {
      console.log(`User attempted to access staff routes`)
      console.log(`login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`)
      res.status(401)
      return res.json({
        error: 'Unauthorized',
        message: 'Token provided does not have `WRITE` access to the @github/ecosystem-primitives repo.'
      })
    }

    console.log(`Staff routes accessed:`)
    console.log(`login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`)

    next()
  } catch (err) {
    console.log({err})
    if (err.code === 401) {
      res.status(401)
      return res.send(err)
    }
    return res.sendStatus(500)
  }
})

app.get('/', (req, res) => {
  res.send({})
})

app.get('/:installationId', async (req, res) => {
  const { Subscription } = require('../models')
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
    console.log(err)
    res.status(500)
    return res.json(err)
  }
})

app.get('/:installationId/repoSyncState.json', async (req, res) => {
  const { Subscription } = require('../models')
  try {
    const subscriptions = await Subscription.getAllForInstallation(req.params.installationId)
    if (!subscriptions.length) {
      return res.sendStatus(404)
    }
    const data = subscriptions[0].dataValues.repoSyncState
    return res.json(data)
  } catch (err) {
    res.status(500)
    return res.json(err)
  }
})

app.post('/:installationId/sync', bodyParser, async (req, res) => {
  const { Subscription } = require('../models')
  const { installationId } = req.params
  const { jiraHost } = req.body

  try {
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return res.sendStatus(404)
    }

    await Subscription.findOrStartSync(subscription)

    res.status(202)
    return res.json({
      message: `Successfully (re)started sync for ${installationId}`
    })
  } catch (err) {
    console.log(err)
    return res.sendStatus(401)
  }
})

app.post('/:installationId/migrate/:undo?', bodyParser, async (req, res) => {
  const { Subscription } = require('../models')
  const { installationId } = req.params
  const { jiraHost } = req.body
  const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)

  if (!subscription) {
    return res.sendStatus(404)
  }

  const getJiraClient = require('../jira/client')
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
