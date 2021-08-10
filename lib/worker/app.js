// FIXME: This is all a bit of a hack to get access to a Probot Application
//        instance, mainly to use the `auth()` method. Probot needs refactored
//        so that method is more easily accessible.

const { Probot } = require('probot');
const { AppSecrets, Installation } = require('../models');
const { getPrivateKey } = require('@probot/get-private-key');

module.exports = async (jiraHost) => {
  try {
    const installation = await Installation.getForHost(jiraHost);
    const host = installation.githubHost;
    const ghaeInstanceData = await AppSecrets.getForHost(host);
    return new Probot({
      appId: (ghaeInstanceData && ghaeInstanceData.appId) || process.env.APP_ID,
      privateKey: (ghaeInstanceData && ghaeInstanceData.privateKey) || getPrivateKey(),
      logLevel: process.env.LOG_LEVEL,
      baseUrl: host && `${process.env.GHE_PROTOCOL || 'https'}://${host}/api/v3`,
    });
  } catch (err) {
    return { error: err };
  }
};
