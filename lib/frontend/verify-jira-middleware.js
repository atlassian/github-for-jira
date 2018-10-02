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
      // The JWT contains a `qsh` field that can be used to verify
      // the request body / query
      // See https://bitbucket.org/atlassian/atlassian-connect-express/src/f434e5a9379a41213acf53b9c2689ce5eec55e21/lib/middleware/authentication.js?at=master&fileviewer=file-view-default#authentication.js-227
      jwt.decode(token, installation.sharedSecret)

      next()
    } catch (error) {
      next(new Error('Unauthorized'))
    }
  }
}
