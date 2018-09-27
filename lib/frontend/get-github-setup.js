const { jiraDomainOptions } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.session.jiraHost) {
    return res.redirect('/github/configuration' + req.session.queryParams)
  }

  return res.render('github-setup.hbs', {
    jiraDomainOptions: jiraDomainOptions()
  })
}
