const { jiraDomainOptions } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.session.jiraHost) {
    res.redirect('/github/configuration' + req.session.queryParams)
  }

  res.render('github-setup.hbs', {
    jiraDomainOptions: jiraDomainOptions()
  })
}
