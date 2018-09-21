module.exports = async (req, res) => {
  if (!req.body.jiraHost) {
    return res.status(400)
      .json({
        error: 'A Jira host must be provided.'
      })
  }

  req.session.jiraHost = `https://${req.body.jiraHost}.atlassian.net`

  if (!req.session.githubToken) {
    return res.redirect('/github/login')
  }

  res.redirect('/github/configuration')
}
