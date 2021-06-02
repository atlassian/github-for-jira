import './config/env'; // Important to be before other dependencies
import throng from 'throng';
import {start} from './worker/main';
import InitializeSentry from './config/sentry';

InitializeSentry();

const throngWorkers = Number(process.env.WEB_CONCURRENCY) || 1;
throng({
  workers: throngWorkers,
  lifetime: Infinity,
}, start);
