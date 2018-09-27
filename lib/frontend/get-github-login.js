module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e

  req.session.jiraHost = jiraHost

  return res.redirect('/github/login')
}
