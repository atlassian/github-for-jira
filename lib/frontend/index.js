const express = require('express')
const path = require('path')
const session = require('express-session')
const sslify = require('express-sslify')

const { Subscription } = require('../models')

function getFrontendApp () {
  const app = express()
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || 'secret',
    cookie: {}
  }

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true)
    sessionSettings.cookie.secure = true
  }

  app.use(session(sessionSettings))

  app.set('view engine', 'hbs')
  app.set('views', path.join(__dirname, '..', '..', 'views'))

  app.use('/public/css-reset', express.static(path.join(__dirname, '..', '..', 'node_modules/@atlaskit/css-reset/dist')))
  app.use('/public/atlassian-ui-kit', express.static(path.join(__dirname, '..', '..', 'node_modules/@atlaskit/reduced-ui-pack/dist')))

  app.get('/jira-configuration', async (req, res) => {
    const jiraHost = req.query.xdm_e
    const subscriptions = await Subscription.getAllForHost(jiraHost)

    res.render('jira-configuration.hbs', {
      host: req.query.xdm_e,
      subscriptions
    })
  })

  return app
}

module.exports = (robot) => {
  const app = robot.route('/pages')

  if (process.env.FORCE_HTTPS) {
    app.use(sslify.HTTPS({ trustProtoHeader: true }))
  }

  app.use(getFrontendApp())
}
