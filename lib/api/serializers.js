const JiraClient = require('../models/jira-client');

const serializeSubscription = (subscription) => ({
  gitHubInstallationId: subscription.gitHubInstallationId,
  jiraHost: subscription.jiraHost,
  createdAt: subscription.createdAt,
  updatedAt: subscription.updatedAt,
  syncStatus: subscription.syncStatus,
});

const serializeJiraInstallation = async (jiraInstallation, log) => {
  const jiraClient = new JiraClient(jiraInstallation, log);

  return {
    clientKey: jiraInstallation.clientKey,
    host: jiraInstallation.jiraHost,
    enabled: jiraInstallation.enabled,
    authorized: (await jiraClient.isAuthorized()),
    gitHubInstallations: (await jiraInstallation.subscriptions()).map((subscription) => serializeSubscription(subscription)),
  };
};

module.exports = {
  serializeSubscription,
  serializeJiraInstallation,
};
