const { GitHubAPI } = require('../config/github-api');
const { sign } = require('jsonwebtoken');
const { Installation, AppSecrets } = require('../models');

module.exports = () => async (req, res, next) => {
  const jiraHost = (req.query && req.query.xdm_e) || (req.body && req.body.jiraHost);
  let host = (req.query && req.query.githubHost);

  if (!host && jiraHost) {
    const installation = await Installation.getForHost(jiraHost);
    host = installation && installation.githubHost;
  }

  if (req.session.githubToken && host) {
    res.locals.github = GitHubAPI({
      auth: { token: req.session.githubToken },
      baseUrl: `https://${host}/api/v3`,
    });
  } else {
    res.locals.github = GitHubAPI();
  }

  const ghaeInstanceData = (host) ? await AppSecrets.getForHost(host) : '';

  if (ghaeInstanceData) {
    res.locals.client = GitHubAPI({
      auth: { token: getSignedJsonWebToken({ appId: ghaeInstanceData.appId, privateKey: ghaeInstanceData.privateKey }) },
      baseUrl: `https://${host}/api/v3`,
    });
  } else {
    res.locals.client = GitHubAPI();
  }

  const isAdminFunction = isAdmin(res.locals.github);
  res.locals.isAdmin = isAdminFunction;

  next();
};

/**
 * @returns true if the user is an admin of the Org or if the repo belongs to that user
 */
function isAdmin(githubClient) {
  return async function ({ org, username, type }) {
    // If this is a user installation, the "admin" is the user that owns the repo
    if (type === 'User') {
      return org === username;
    }

    // Otherwise this is an Organization installation and we need to ask GitHub for role of the logged in user
    try {
      const {
        data: { role },
      } = await githubClient.orgs.getMembershipForUser({ org, username });
      return role === 'admin';
    } catch (err) {
      console.log(err);
      console.log(`${org} has not accepted new permission for getOrgMembership`);
      console.log(`error=${err} org=${org}`);
      return false;
    }
  };
}

function getSignedJsonWebToken({ appId, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 60 * 10 - 30,
    iss: appId,
  };
  const token = sign(payload, privateKey, { algorithm: 'RS256' });
  return token;
}

module.exports.isAdminFunction = isAdmin;
