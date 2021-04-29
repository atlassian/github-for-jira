module.exports = async (req, res) => {
  req.session.jiraHost = req.query.xdm_e;
  return res.redirect('/github/login');
};
