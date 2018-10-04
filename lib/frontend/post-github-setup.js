const { validJiraDomains, jiraDomainOptions } = require('./validations')

module.exports = async (req, res) => {
  const { jiraSubdomain, jiraDomain } = req.body
  if (!validJiraDomains(jiraSubdomain, jiraDomain)) {
    res.status(400)
    return res.render('github-setup.hbs', {
      error: 'The entered Jira Cloud Site is not valid',
      jiraSubdomain,
      jiraDomainOptions: jiraDomainOptions(jiraDomain),
      csrfToken: req.csrfToken()
    })
  }

  req.session.jiraHost = `https://${jiraSubdomain}.${jiraDomain}`

  if (!req.session.githubToken) {
    return res.redirect('/github/login')
  }

  return res.redirect(`${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`)
}
