module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('Unauthorized'))
  }

  const { github, client } = res.locals

  /**
   * @returns true if the user is an admin of the Org or if the repo belongs to that user
   */
  async function isAdmin ({ org, username, type }) {
    console.log(org, username, type)
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
      console.log(`${org} has not accepted new permission for getOrgMembership`)
      console.log(`error=${err} org=${org}`)
      return false
    }
  }

  if (req.query.jwt && req.query.xdm_e) {
    const { sub: login } = getPayloadFromParams(req.session.queryParams)
    try {
      const {
        data: { installations }
      } = await github.users.getInstallations({})

      const adminInstallations = []
      for (const installation of installations) {
        // See if we can get the membership for this user
        if (
          await isAdmin({
            org: installation.account.login,
            username: login,
            type: installation.target_type
          })
        ) {
          adminInstallations.push(installation)
        }
      }

      const { data: info } = await client.apps.get({})
      return res.render('github-configuration.hbs', {
        csrfToken: req.csrfToken(),
        installations: adminInstallations,
        info,
        jiraHost: req.session.jiraHost
      })
    } catch (err) {
      console.log(
        `Unable to show github configuration page. error=${err}, jiraHost=${req.session.jiraHost}, login=${login}`
      )
      return next(new Error(err))
    }
  } else {
    return res.redirect(
      `${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`
    )
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
