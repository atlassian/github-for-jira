import { metricHttpRequest } from '../config/metric-names';
import statsd from '../config/statsd';
import { Subscription } from '../models';
import { getLogger } from '../config/logger';

const logger = getLogger('metrics-job')

export default async (): Promise<void> => {
  logger.info("Received sync status metrics event. Getting sync status count for sync status metrics.")
  const syncStatusCounts = await Subscription.syncStatusCounts();

  syncStatusCounts.forEach((row) => {
    statsd.gauge(metricHttpRequest().requestStatusSync, row.count, {
      status: row.syncStatus,
    });
  });
};
