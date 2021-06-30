import dotenv from 'dotenv';
import path from 'path';
import envVars from './env';

const filename = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const env = dotenv.config({
  path: path.resolve(process.cwd(), filename),
});

export default {
  MICROS_ENV: process.env.MICROS_ENV || 'development',
  MICROS_SERVICE_VERSION: process.env.MICROS_SERVICE_VERSION,
  NODE_ENV: process.env.NODE_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN,
  ...env.parsed,
};

// TODO: add checks for environment variables here and error out if missing any
if (env.error && envVars.NODE_ENV !== 'production') {
  throw env.error;
}
