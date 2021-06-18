// FIXME: This is all a bit of a hack to get access to a Probot Application
//        instance, mainly to use the `auth()` method. Probot needs refactored
//        so that method is more easily accessible.

const { Server, Probot } = require('probot');
const { getPrivateKey } = require('@probot/get-private-key');

const server = new Server({
  Probot: Probot.defaults({
    appId: process.env.APP_ID,
    privateKey: getPrivateKey(),
    logLevel: process.env.LOG_LEVEL,
  }),
});

// Load an empty app so we can get access to probot's auth handling
server.load(() => {});
const app = server.probotApp;

module.exports = app;
