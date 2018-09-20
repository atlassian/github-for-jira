module.exports = async (req, res, next) => {
  if (!req.session.githubToken) {
    return next(new Error('Unauthorized'))
  }

  if (req.session.jiraHost) {
    return res.redirect('/github/configuration')
  }

  res.render('github-setup.hbs', {
    title: 'Setup'
  })
}
