import throng from "throng";
import { start } from "./worker/main";
import InitializeSentry from "./config/sentry";

InitializeSentry();

const workers = Number(process.env.WEB_CONCURRENCY) || 1;

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (workers > 1) {
  throng({
    workers: workers,
    lifetime: Infinity
  }, start);
} else {
  start();
}

