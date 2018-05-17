module.exports = async (req, res) => {
  req.log('App installed on Jira. Adding secrets.', req.body)

  // Store shared_secret in Postgres

  return res.sendStatus(200)
}
