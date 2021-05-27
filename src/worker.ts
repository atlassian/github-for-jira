import dotenv from 'dotenv';
import throng from 'throng';
import {start} from './worker/main';
import InitializeSentry from './config/sentry';

dotenv.config();
InitializeSentry();

const throngWorkers = Number(process.env.WEB_CONCURRENCY) || 1;
throng({
  workers: throngWorkers,
  lifetime: Infinity,
}, start);
