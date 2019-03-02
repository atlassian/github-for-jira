const { Subscription } = require('../models')

module.exports = async (req, res) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return res.sendStatus(401)
  }

  if (!req.body.installationId) {
    return res.status(400).json({
      error:
        'An Installation ID must be provided to link an installation and a Jira host.'
    })
  }

  // Check if the user that posted this has access to the installation ID they're requesting
  try {
    const { data: { installations } } = await res.locals.github.users.getInstallations({})
    const userInstallations = installations.find(installation => {
      return installation.id === Number(req.body.installationId)
    })

    if (!userInstallations) {
      return res
        .json({
          err: {
            message: `Failed to add subscription to ${req.body.installationId}. User does not have access to that installation.`
          }
        })
        .status(401)
    }

    await Subscription.install({
      installationId: req.body.installationId,
      host: req.session.jiraHost
    })

    return res.sendStatus(200)
  } catch (err) {
    return res.json({ err }).status(400)
  }
}
