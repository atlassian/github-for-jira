module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('Unauthorized'))
  }

  const { data: { installations } } = (await res.locals.github.users.getInstallations({}))
  const { data: info } = (await res.locals.client.apps.get({}))

  res.render('github-configuration.hbs', {
    installations,
    info
  })
}
