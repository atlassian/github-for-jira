export const envVars = {
  MICROS_ENV: process.env.MICROS_ENV || "development",
  MICROS_SERVICE_VERSION: process.env.MICROS_SERVICE_VERSION,
  NODE_ENV: process.env.NODE_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN,
};
