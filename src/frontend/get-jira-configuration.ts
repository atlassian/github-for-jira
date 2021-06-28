import format from 'date-fns/format';
import moment from 'moment';
import { Subscription } from '../models';
import { NextFunction, Request, Response } from 'express';
import statsd from '../config/statsd';

const syncStatus = (syncStatus) =>
  syncStatus === 'ACTIVE' ? 'IN PROGRESS' : syncStatus;

async function getInstallation(client, subscription) {
  const id = subscription.gitHubInstallationId;
  try {
    const response = await client.apps.getInstallation({ installation_id: id });
    response.data.syncStatus = subscription.isInProgressSyncStalled()
      ? 'STALLED'
      : syncStatus(subscription.syncStatus);
    response.data.syncWarning = subscription.syncWarning;
    response.data.subscriptionUpdatedAt = formatDate(subscription.updatedAt);
    response.data.totalNumberOfRepos = Object.keys(
      subscription.repoSyncState?.repos || {},
    ).length;
    response.data.numberOfSyncedRepos =
      subscription.repoSyncState?.numberOfSyncedRepos || 0;

    response.data.syncStatus === 'STALLED' &&
      statsd.increment('app.server.sync-status.stalled');
      
    return response.data;
  } catch (err) {
    return { error: err, id, deleted: err.code === 404 };
  }
}

const formatDate = function (date) {
  return {
    relative: moment(date).fromNow(),
    absolute: format(date, 'MMMM D, YYYY h:mm a'),
  };
};

export default async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const jiraHost = req.session.jiraHost;
    const { client } = res.locals;
    const subscriptions = await Subscription.getAllForHost(jiraHost);
    const installations = await Promise.all(
      subscriptions.map((subscription) =>
        getInstallation(client, subscription),
      ),
    );

    const connections = installations
      .filter((response) => !response.error)
      .map((data) => ({
        ...data,
        isGlobalInstall: data.repository_selection === 'all',
        installedAt: formatDate(data.updated_at),
        syncState: data.syncState,
        repoSyncState: data.repoSyncState,
      }));

    const failedConnections = installations.filter(
      (response) => !!response.error,
    );

    res.render('jira-configuration.hbs', {
      host: jiraHost,
      connections,
      failedConnections,
      hasConnections: connections.length > 0 || failedConnections.length > 0,
      APP_URL: process.env.APP_URL,
      csrfToken: req.csrfToken(),
    });

    req.log.info('Jira configuration rendered successfully.');
  } catch (error) {
    return next(new Error(`Failed to render Jira configuration: ${error}`));
  }
};
