module.exports = async (req, res) => {
  req.log('App installed on Jira. Adding secrets.', req.body);

  return res.sendStatus(200);
};
