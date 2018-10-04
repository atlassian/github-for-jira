module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('Unauthorized'))
  }

  if (req.query.jwt && req.query.xdm_e) {
    const { data: { installations } } = (await res.locals.github.users.getInstallations({}))
    const { data: info } = (await res.locals.client.apps.get({}))
    return res.render('github-configuration.hbs', {
      csrfToken: req.csrfToken(),
      installations,
      info
    })
  } else {
    return res.redirect(`${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`)
  }
}
