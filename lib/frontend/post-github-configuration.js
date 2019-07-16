const { Subscription } = require('../models')
const { getHashedKey } = require('../models/installation')

module.exports = async (req, res) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return res.sendStatus(401)
  }

  if (!req.body.installationId) {
    res.status(400)
    return res.json({
      err: 'An Installation ID must be provided to link an installation and a Jira host.'
    })
  }

  // Check if the user that posted this has access to the installation ID they're requesting
  try {
    const { data: { installations } } = await res.locals.github.users.getInstallations({})

    const userInstallations = installations.find(installation => {
      return installation.id === Number(req.body.installationId)
    })

    if (!userInstallations) {
      res.status(401)
      return res.json({
        err: `Failed to add subscription to ${req.body.installationId}. User does not have access to that installation.`
      })
    }

    await Subscription.install({
      clientKey: getHashedKey(req.body.clientKey),
      installationId: req.body.installationId,
      host: req.session.jiraHost
    })

    return res.sendStatus(200)
  } catch (err) {
    console.log(err)
    return res.sendStatus(400)
  }
}
