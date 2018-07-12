const sslify = require('express-sslify')

const getFrontendApp = require('./app')

module.exports = (robot) => {
  const app = robot.route()

  if (process.env.FORCE_HTTPS) {
    app.use(sslify.HTTPS({ trustProtoHeader: true }))
  }

  app.use(getFrontendApp(robot.app))
}
