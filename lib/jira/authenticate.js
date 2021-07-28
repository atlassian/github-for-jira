const { Installation } = require('../models');
const { hasValidJwt } = require('./util/jwt');

module.exports = async (req, res, next) => {
  const installation = await Installation.getForClientKey(req.body.clientKey);
  if (!installation) {
    res.status(404).json({});
    return;
  }

  const { jiraHost, sharedSecret, clientKey } = installation;

  req.addLogFields({ jiraHost, jiraClientKey: clientKey });
  res.locals.installation = installation;

  if (hasValidJwt(sharedSecret, jiraHost, req, res)) {
    next();
  }
};
