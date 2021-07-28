import dotenv from "dotenv";
import path from "path";
import { LogLevelString } from "bunyan";

export enum EnvironmentEnum {
  test = "test",
  development = "development",
  production = "production",
}

export enum BooleanEnum {
  true = "true",
  false = "false",
}

const nodeEnv: EnvironmentEnum = EnvironmentEnum[process.env.NODE_ENV];

const filename = nodeEnv === EnvironmentEnum.test ? ".env.test" : ".env";
const env = dotenv.config({
  path: path.resolve(process.cwd(), filename)
});

// TODO: add checks for environment variables here and error out if missing any
if (env.error && nodeEnv !== EnvironmentEnum.production) {
  throw env.error;
}

const getProxyFromEnvironment = (): string => {
  const proxyHost = process.env.EXTERNAL_ONLY_PROXY_HOST;
  const proxyPort = process.env.EXTERNAL_ONLY_PROXY_PORT;
  return proxyHost && proxyPort ? `http://${proxyHost}:${proxyPort}` : undefined;
};

// TODO: Make envvars dynamic
const envVars: EnvVars = {
  MICROS_ENV: EnvironmentEnum[process.env.MICROS_ENV || EnvironmentEnum.development],
  MICROS_SERVICE_VERSION: process.env.MICROS_SERVICE_VERSION,
  NODE_ENV: nodeEnv,
  SENTRY_DSN: process.env.SENTRY_DSN,
  PROXY: getProxyFromEnvironment(),
  MAINTENANCE_MODE: BooleanEnum[process.env.MAINTENANCE_MODE] || BooleanEnum.false,
  ...env.parsed
} as EnvVars;

export const isMaintenanceMode = () => process.env.MAINTENANCE_MODE === BooleanEnum.true;

export default envVars;

export interface EnvVars {
  NODE_ENV: EnvironmentEnum,
  MICROS_ENV: EnvironmentEnum;
  MICROS_SERVICE_VERSION?: string,

  APP_ID: string;
  APP_URL: string;
  WEBHOOK_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ATLASSIAN_SECRET: string;
  INSTANCE_NAME: string;
  DATABASE_URL: string;
  STORAGE_SECRET: string;
  PRIVATE_KEY_PATH: string;
  ATLASSIAN_URL: string;
  WEBHOOK_PROXY_URL: string;
  TUNNEL_PORT?: string;
  TUNNEL_SUBDOMAIN?: string;
  TRACKING_DISABLED?: BooleanEnum;
  HYDRO_BASE_URL?: string;
  HYDRO_APP_SECRET?: string;
  LOG_LEVEL?: LogLevelString;
  SENTRY_DSN?: string,
  PROXY?: string,
  MAINTENANCE_MODE?: BooleanEnum,
}
