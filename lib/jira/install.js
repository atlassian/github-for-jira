const { Installation } = require('../models')

module.exports = async (req, res) => {
  req.log('Received installation payload')
  const { baseUrl: host, clientKey, sharedSecret } = req.body
  await Installation.install({ host, clientKey, sharedSecret })
  return res.sendStatus(204)
}
