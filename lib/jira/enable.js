const { Installation } = require('../models')

module.exports = async (req, res) => {
  req.log('App enabled on Jira.')

  const installation = await Installation.getForHost(req.body.baseUrl, false)

  if (installation) {
    await installation.enable()
  }

  return res.sendStatus(204)
}
