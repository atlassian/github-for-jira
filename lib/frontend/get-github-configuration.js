module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('Unauthorized'))
  }

  if (req.query.jwt && req.query.xdm_e) {
    try {
      const { data: { installations } } = (await res.locals.github.users.getInstallations({}))
      const { data: { login } } = await res.locals.github.users.get()
      
      async function isAdmin({ org, username }) {
        try {
          const { data: { role } } = await res.locals.github.orgs.getOrgMembership({ org, username })
          if (role === 'admin') return Promise.resolve(true)
        } catch(err) {
          return Promise.resolve(false)
        }
      }

      const adminInstallations = []
      for (const installation of installations) {
        // See if we can get the membership for this user
        if (await isAdmin({ org: installation.account.login, username: login}) || installation.target_type === 'User') {
          adminInstallations.push(installation)
        }

      }

      const { data: info } = (await res.locals.client.apps.get({}))
      return res.render('github-configuration.hbs', {
        csrfToken: req.csrfToken(),
        installations: adminInstallations,
        info
      })
    }
    catch (err) {
      return res.send(err)
    }
  } else {
    return res.redirect(`${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`)
  }
}
