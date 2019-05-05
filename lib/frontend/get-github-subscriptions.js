const { Subscription } = require('../models')

module.exports = async (req, res, next) => {
  if (!req.session.githubToken) {
    return next(new Error('Unauthorized'))
  }

  const { github, client } = res.locals

  /**
   * @returns true if the user is an admin of the Org or if the repo belongs to that user
   */
  async function isAdmin ({ org, username, type }) {
    // If this is a user installation, the "admin" is the user that owns the repo
    if (type === 'User') {
      return org === username
    }

    // Otherwise this is an Organization installation and we need to ask GitHub for role of the logged in user
    try {
      const {
        data: { role }
      } = await github.orgs.getOrgMembership({ org, username })
      return role === 'admin'
    } catch (err) {
      // If we failed to get the organization membership, do not show this installation
      console.log(`${org} has not accepted new permission for getOrgMembership`)
      console.log(`error=${err} org=${org}`)
      return false
    }
  }

    const { sub: login } = getPayloadFromParams(req.session.queryParams)
    const { installationId } = req.params
    try {
      // get the installation to see if the user is an admin of it
      const { data: installation } = await client.apps.getInstallation({ installation_id: installationId })
      // get all subscriptions from the database for this installation ID
      const subscriptions = await Subscription.getAllForInstallation(installationId)
      // Only show the page if the logged in user is an admin of this installation
      if (await isAdmin({
          org: installation.account.login,
          username: login,
          type: installation.target_type
        })) {
          const { data: info } = await client.apps.get({})
          return res.render('github-subscriptions.hbs', {
            csrfToken: req.csrfToken(),
            installation,
            info,
            subscriptions,
            hasSubscriptions: subscriptions.length > 0
          })
        } else {
          return next(new Error('Unauthorized'))
        } 

    } catch (err) {
      console.log(`Unable to show subscription page. error=${err}, installation=${req.params.installationId}, login=${login}`)
      return next(new Error('Not Found'))
    }
}

/**
 * This is a bit of a hack, but we need the user login for multiple reasons
 * so to save an API call and prevent us from logging the JWT in the console,
 * this just extracts the part of the JWT that has user information
 */
function getPayloadFromParams (params) {
  // This is the part of the JWT that has the username
  const payload = params.split('.')[1]

  // base64 decode it
  const data = Buffer.from(payload, 'base64').toString()
  return JSON.parse(data)
}
