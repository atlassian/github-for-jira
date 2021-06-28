import statsd from '../config/statsd';
import {Subscription} from '../models';

export default async (): Promise<void> => {
  const syncStatusCounts = await Subscription.syncStatusCounts();

  syncStatusCounts.forEach((row) => {
    statsd.gauge('app.server.http.request.request-status-syncs', row.count, {status: row.syncStatus});
  });
};
