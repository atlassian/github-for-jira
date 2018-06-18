module.exports = async (req, res) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return res.sendStatus(401)
  }

  const installations = (await res.locals.github.users.getInstallations({})).data.installations
  const info = (await res.locals.client.apps.get({})).data

  res.render('github-configuration.hbs', {
    installations,
    info
  })
}
