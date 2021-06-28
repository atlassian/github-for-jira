import throng from "throng";
import { start } from "./worker/main";
import InitializeSentry from "./config/sentry";

const isProd = process.env.NODE_ENV === 'production';
InitializeSentry();

// TODO: this should work in dev/production and should be `workers = process.env.NODE_ENV === 'production' ? undefined : 1`
if (isProd) {
  throng({
    lifetime: Infinity
  }, start);
} else {
  start();
}

