const express = require('express')
const format = require('date-fns/format')
const app = express()
const bodyParser = require('body-parser').urlencoded({ extended: false })
const octokit = require('@octokit/rest')()

const { Installation } = require('../models')
const verifyInstallation = require('../jira/verify-installation')
const logMiddleware = require('../middleware/log-middleware')
const JiraClient = require('../models/jira-client')

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

function validViewerPermission (viewer) {
  switch (viewer.organization.repository.viewerPermission) {
    case 'WRITE':
    case 'ADMIN':
      return true
    default:
      return false
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

app.use(logMiddleware)

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

    req.addLogFields({ login: (data && data.viewer && data.viewer.login) })

    if (errors) {
      res.status(401)
      return res.json({ errors, viewerPermissionQuery })
    }

    if (!data.viewer.organization) {
      req.log.info(`Non-GitHub scoped token attempted to access staff routes: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}`)

      res.status(401)
      return res.json({
        error: 'Unauthorized',
        message: 'Token provided does not have access to the `github` organization'
      })
    }

    if (!validViewerPermission(data.viewer)) {
      req.log.info(
        `User attempted to access staff routes: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`
      )

      res.status(401)
      return res.json({
        error: 'Unauthorized',
        message: 'Token provided does not have `WRITE` or `ADMIN` access to the @github/ecosystem-primitives repo.'
      })
    }

    req.log.info(`Staff routes accessed: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`)

    next()
  } catch (err) {
    req.log.info({ err })

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
      req.log.error(response.error)
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
    req.log.error(err)
    res.status(500)
    return res.json(err)
  }
})

app.get('/:installationId/repoSyncState.json', async (req, res) => {
  const { Subscription } = require('../models')
  const { installationId } = req.params
  const { jiraHost } = req.query

  try {
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return res.sendStatus(404)
    }
    const data = subscription.dataValues.repoSyncState
    return res.json(data)
  } catch (err) {
    res.status(500)
    return res.json(err)
  }
})

app.post('/:installationId/sync', bodyParser, async (req, res) => {
  const { Subscription } = require('../models')
  const { installationId } = req.params
  req.log.info(req.body)
  const { jiraHost } = req.body

  try {
    req.log.info(jiraHost, installationId)
    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return res.sendStatus(404)
    }

    const type = req.body.resetType || null
    await Subscription.findOrStartSync(subscription, type)

    res.status(202)
    return res.json({
      message: `Successfully (re)started sync for ${installationId}`
    })
  } catch (err) {
    req.log.info(err)
    return res.sendStatus(401)
  }
})

app.get('/jira/:clientKey', bodyParser, async (request, response) => {
  const installation = await Installation.findOne({ where: { clientKey: request.params.clientKey } })
  const jiraClient = new JiraClient(installation, request.log)
  const subscriptionSummary = (subscription) => {
    return {
      gitHubInstallationId: subscription.gitHubInstallationId,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      syncStatus: subscription.syncStatus
    }
  }

  const data = {
    clientKey: installation.clientKey,
    host: installation.jiraHost,
    enabled: installation.enabled,
    authorized: (await jiraClient.isAuthorized()),
    gitHubInstallations: (await installation.subscriptions()).map((subscription) => subscriptionSummary(subscription))
  }

  response.json(data)
})

app.post('/jira/:clientKey/uninstall', bodyParser, async (request, response) => {
  response.locals.installation = await Installation.findOne({ where: { clientKey: request.params.clientKey } })

  if (response.locals.installation) {
    const jiraClient = new JiraClient(response.locals.installation, request.log)
    const checkAuthorization = request.body.force !== 'true'

    if (checkAuthorization && jiraClient.isAuthorized()) {
      response.status(400).json({ message: 'Refusing to uninstall authorized Jira installation' })
    } else {
      request.log.info(`Forcing uninstall for ${response.locals.installation.clientKey}`)

      const uninstall = require('../jira/uninstall')
      await uninstall(request, response)
    }
  } else {
    response.sendStatus(404)
  }
})

app.post('/jira/:installationId/verify', bodyParser, async (req, response) => {
  const { installationId } = req.params
  const installation = await Installation.findById(installationId)

  const respondWith = function (message) {
    const data = {
      message: message,
      installation: { enabled: installation.enabled, id: installation.id, jiraHost: installation.jiraHost }
    }

    return response.send(JSON.stringify(data))
  }

  if (installation.enabled) {
    respondWith('Installation already enabled')
  } else {
    await verifyInstallation(installation, req.log)()

    if (installation.enabled) {
      respondWith('Verification successful')
    } else {
      respondWith('Verification failed')
    }
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
  const jiraClient = await getJiraClient(jiraHost, installationId, req.log)

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

app.get('/boom', (req, res, next) => { 'staff boom'.nopenope() })
app.post('/boom', (req, res, next) => { 'staff boom'.nopenope() })

module.exports = app
