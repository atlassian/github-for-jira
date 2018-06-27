const jwt = require('atlassian-jwt')

const { Installation } = require('../models')

module.exports = async function verifyJiraRequest (req, res, next) {
  const jiraHost = req.query.xdm_e
  const token = req.query.jwt

  const installation = await Installation.getForHost(jiraHost)

  if (!installation) {
    next(new Error('Not Found'))
  } else {
    try {
      jwt.decode(token, installation.sharedSecret)

      next()
    } catch (error) {
      next(new Error('Unauthorized'))
    }
  }
}
