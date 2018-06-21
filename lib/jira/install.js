const { Installation } = require('../models')

module.exports = async (req, res) => {
  req.log('App installed on Jira. Adding secrets.')

  await Installation.install({
    host: req.body.baseUrl,
    sharedSecret: req.body.sharedSecret
  })

  return res.sendStatus(204)
}
