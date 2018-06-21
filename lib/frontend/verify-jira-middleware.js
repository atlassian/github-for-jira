const jwt = require('atlassian-jwt')

const { Installation } = require('../models')

module.exports = async function verifyJiraRequest (req, res, next) {
  const jiraHost = req.query.xdm_e
  const token = req.query.jwt

  const installation = await Installation.getForHost(jiraHost)

  if (!installation) {
    res.sendStatus(404)
  } else {
    try {
      jwt.decode(token, installation.sharedSecret)

      next()
    } catch (error) {
      res.sendStatus(401)
    }
  }
}
