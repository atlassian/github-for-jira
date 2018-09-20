module.exports = async (req, res) => {
  if (!req.session.githubToken) {
    return res.sendStatus(401)
  }

  if (!req.body.jiraHost) {
    return res.status(400)
      .json({
        error: 'A Jira host must be provided.'
      })
  }

  req.session.jiraHost = `https://${req.body.jiraHost}.atlassian.net`

  res.redirect('/github/configuration')
}
