import JiraClient from '../models/jira-client';
import Subscription from '../models/subscription';
import Installation from '../models/installation';
import Logger from 'bunyan';

type SerializedSubscription = Pick<Subscription, 'gitHubInstallationId' | 'jiraHost' | 'createdAt' | 'updatedAt' | 'syncStatus'>;
export const serializeSubscription = (subscription: Subscription): SerializedSubscription => ({
  gitHubInstallationId: subscription.gitHubInstallationId,
  jiraHost: subscription.jiraHost,
  createdAt: subscription.createdAt,
  updatedAt: subscription.updatedAt,
  syncStatus: subscription.syncStatus,
});

interface SerializedInstallation extends Pick<Installation, 'clientKey' | 'enabled'> {
  host: string;
  authorized: boolean;
  gitHubInstallations: SerializedSubscription[];
}

export const serializeJiraInstallation = async (jiraInstallation: Installation, log: Logger): Promise<SerializedInstallation> => {
  const jiraClient = new JiraClient(jiraInstallation, log);

  return {
    clientKey: jiraInstallation.clientKey,
    host: jiraInstallation.jiraHost,
    enabled: jiraInstallation.enabled,
    authorized: (await jiraClient.isAuthorized()),
    gitHubInstallations: (await jiraInstallation.subscriptions()).map((subscription) => serializeSubscription(subscription)),
  };
};
