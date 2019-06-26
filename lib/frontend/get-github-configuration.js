module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('Unauthorized'))
  }

  const { github, client, isAdmin } = res.locals

  async function getInstallationsWithAdmin ({installations, login}) {
    const installationsWithAdmin = []
    for (const installation of installations) {
      // See if we can get the membership for this user
      const admin = await isAdmin({
        org: installation.account.login,
        username: login,
        type: installation.target_type
      })
      installationsWithAdmin.push({...installation, admin})
    }
    return installationsWithAdmin
  }

  if (req.query.jwt && req.query.xdm_e) {
    const { data: { login } } = await github.users.get()
    try {
      const {
        data: { installations }
      } = await github.users.getInstallations({})

      const installationsWithAdmin = await getInstallationsWithAdmin({installations, login})

      const { data: info } = await client.apps.get({})
      return res.render('github-configuration.hbs', {
        csrfToken: req.csrfToken(),
        installations: installationsWithAdmin,
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
