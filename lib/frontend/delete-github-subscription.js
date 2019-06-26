const { Subscription } = require('../models')

module.exports = async (req, res) => {
  if (!req.session.githubToken) {
    return res.sendStatus(401)
  }

  if (!req.body.installationId || !req.body.jiraHost) {
    res.status(400)
    return res.json({
      err: 'installationId and jiraHost must be provided to delete a subscription.'
    })
  }

  /**
   * Returns the role of the user for an Org or 'admin' if the
   * installation belongs to the current user
   * @returns {string}
   */
  async function getRole ({login, installation}) {
    if (installation.target_type === 'Organization') {
      const { data: { role } } = await res.locals.github.orgs.getOrgMembership({ org: installation.account.login, username: login })
      return role
    } else if (installation.target_type === 'User') {
      return (login === installation.account.login) ? 'admin' : ''
    } else {
      throw new Error(`unknown "target_type" on installation id ${req.body.installationId}.`)
    }
  }

  // Check if the user that posted this has access to the installation ID they're requesting
  try {
    const { data: { installations } } = await res.locals.github.users.getInstallations({})

    const userInstallation = installations.find(installation => {
      return installation.id === Number(req.body.installationId)
    })

    if (!userInstallation) {
      res.status(401)
      return res.json({
        err: `Failed to delete subscription for ${req.body.installationId}. User does not have access to that installation.`
      })
    }
    const { data: { login } } = await res.locals.github.users.get()

    // If the installation is an Org, the user needs to be an admin for that Org
    try {
      const role = await getRole({ login, installation: userInstallation })
      await Subscription.uninstall({
        installationId: req.body.installationId,
        host: req.body.jiraHost,
        role
      })
      return res.sendStatus(202)
    } catch (err) {
      res.status(403)
      return res.json({
        err: `Failed to delete subscription to ${req.body.installationId}. ${err}`
      })
    }
  } catch (err) {
    console.log(err)
    return res.sendStatus(400)
  }
}
