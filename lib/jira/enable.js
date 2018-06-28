const { Installation } = require('../models')

module.exports = async (req, res) => {
  req.log('App enabled on Jira.')

  const installation = await Installation.getForClientKey(req.body.clientKey)

  if (!installation) {
    await installation.enable()
  }

  return res.sendStatus(204)
}
