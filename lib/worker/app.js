// FIXME: This is all a bit of a hack to get access to a Probot Application
//        instance, mainly to use the `auth()` method. Probot needs refactored
//        so that method is more easily accessible.

const { Probot } = require('probot');
const { AppSecrets, Installation } = require('../models');
const { getPrivateKey } = require('@probot/get-private-key');
const configConst = require('../config-constants');

module.exports = async (jiraHost) => {
  try {
    const installation = await Installation.getForHost(jiraHost);
    const host = installation.githubHost;
    const ghaeInstanceData = await AppSecrets.getForHost(host);
    return new Probot({
      appId: (ghaeInstanceData && ghaeInstanceData.appId) || configConst.DUMMY_APP_ID,
      privateKey: (ghaeInstanceData && ghaeInstanceData.privateKey) || configConst.DUMMY_PRIVATE_KEY,
      logLevel: process.env.LOG_LEVEL,
      baseUrl: host && `${process.env.GHE_PROTOCOL || 'https'}://${host}/api/v3`,
    });
  } catch (err) {
    console.log('Worker Error');
    return { error: err };
  }
};
