const { jiraDomainOptions } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.session.jiraHost) {
    const queryParams = req.session.queryParams || ''
    return res.redirect('/github/configuration' + queryParams)
  }

  return res.render('github-setup.hbs', {
    jiraDomainOptions: jiraDomainOptions()
  })
}
