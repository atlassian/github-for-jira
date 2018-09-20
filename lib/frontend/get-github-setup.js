module.exports = async (req, res, next) => {
  if (!req.session.githubToken) {
    return next(new Error('Unauthorized'))
  }

  res.render('github-setup.hbs', {
    title: 'Setup'
  })
}
