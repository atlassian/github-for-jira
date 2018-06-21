module.exports = async (req, res) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return res.sendStatus(401)
  }

  const { data: { installations } } = (await res.locals.github.users.getInstallations({}))
  const { data: info } = (await res.locals.client.apps.get({}))

  res.render('github-configuration.hbs', {
    installations,
    info
  })
}
