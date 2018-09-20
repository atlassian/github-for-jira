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

  req.session.jiraHost = req.body.jiraHost

  res.redirect('/github/configuration')
}
