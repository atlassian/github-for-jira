const { Installation } = require('../models')

module.exports = async (req, res) => {
  req.log('App disabled on Jira.')

  const installation = await Installation.getForHost(req.body.baseUrl, false)

  if (installation) {
    await installation.disable()
  }

  return res.sendStatus(204)
}
