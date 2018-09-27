const { jiraDomainOptions } = require('./validations')

module.exports = async (req, res, next) => {
  res.render('github-setup.hbs', {
    jiraDomainOptions: jiraDomainOptions()
  })
}
