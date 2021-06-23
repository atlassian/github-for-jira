import statsd from '../config/statsd';
import { Subscription } from '../models';

export default async (): Promise<void> => {
  const syncStatusCounts = await Subscription.syncStatusCounts();

  syncStatusCounts.forEach((row) => {
    statsd.gauge('syncs', row.count, {
      status: row.syncStatus,
      environment: process.env.NODE_ENV,
      environment_type: process.env.MICROS_ENVTYPE,
    });
  });
};
