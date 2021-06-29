import { metricHttpRequest } from '../config/metric-names';
import statsd from '../config/statsd';
import { Subscription } from '../models';

export default async (): Promise<void> => {
  const syncStatusCounts = await Subscription.syncStatusCounts();

  syncStatusCounts.forEach((row) => {
    statsd.gauge(metricHttpRequest().requestStatusSync, row.count, {
      status: row.syncStatus,
    });
  });
};
