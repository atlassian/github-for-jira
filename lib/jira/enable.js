const Installation = require('../models/installation');
const verifyInstallation = require('./verify-installation');

module.exports = async (req, res) => {
  const jiraHost = req.body.baseUrl;

  const installation = await Installation.getPendingHost(jiraHost);
  if (installation) {
    res.on('finish', verifyInstallation(installation, req.log));
    res.sendStatus(204);
  } else {
    req.log(`No pending installation found for jiraHost=${jiraHost}`);
    res.sendStatus(422);
  }
};
