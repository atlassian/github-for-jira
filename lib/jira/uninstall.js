const { Installation } = require('../models')

module.exports = async (req, res) => {
  req.log('App uninstalled on Jira. Removing secrets.')

  await Installation.uninstall({
    host: req.body.baseUrl
  })

  return res.sendStatus(204)
}
