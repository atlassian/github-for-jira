import dotenv from 'dotenv';
dotenv.config();
import { queues } from './worker/main'

queues.metrics.add({})
  .then(() => process.exit(0))
  .catch((error) => {
    console.log('An error occurred while enqueuing the metrics job:', error)
    process.exit(1)
  })
