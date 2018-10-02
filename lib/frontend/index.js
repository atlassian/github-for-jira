const sslify = require('express-sslify')
const helmet = require('helmet')

const getFrontendApp = require('./app')

function secureHeaders (app) {
  // Content Security Policy
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'https://*.githubusercontent.com', 'https://octodex.github.com']
    }
  }))
  // Enable HSTS with the value we use for education.github.com
  app.use(helmet.hsts({
    maxAge: 15552000
  }))
  // X-Frame / Clickjacking protection
  app.use(helmet.frameguard({ action: 'deny' }))
  // MIME-Handling: Force Save in IE
  app.use(helmet.ieNoOpen())
  // Disable cachingç
  app.use(helmet.noCache())
  // Disable mimetype sniffing
  app.use(helmet.noSniff())
  // Basic XSS Protectio
  app.use(helmet.xssFilter())

  // Remove the X-Powered-By
  // TODO: this does not work, neither app.disable('x-powered-by')
  app.use(helmet.hidePoweredBy())
}

module.exports = (robot) => {
  const app = robot.route()

  if (process.env.FORCE_HTTPS) {
    app.use(sslify.HTTPS({ trustProtoHeader: true }))
  }

  secureHeaders(app)
  app.use(getFrontendApp(robot.app))
}
