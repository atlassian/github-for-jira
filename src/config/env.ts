import dotenv from "dotenv";
import path from "path";
import { LogLevelString } from "bunyan";
import { getNodeEnv, isNodeTest } from "../util/isNodeEnv";
import { EnvironmentEnum } from "../interfaces/common";

const nodeEnv: EnvironmentEnum = EnvironmentEnum[getNodeEnv()];

const filename = isNodeTest() ? ".env.test" : ".env";
const env = dotenv.config({
	path: path.resolve(process.cwd(), filename)
});

// TODO: add checks for environment variables here and error out if missing any
if (env.error && nodeEnv !== EnvironmentEnum.production) {
	throw env.error;
}

// TODO: Use whitelist proxy instead
const getProxyFromEnvironment = (): string | undefined => {
	const proxy = process.env.WHITELIST_PROXY;
	return proxy ? `http://${proxy}` : undefined;
};

// TODO: Make envvars dynamic
const envVars: EnvVars = {
	...process.env,
	...env.parsed,
	MICROS_ENV: EnvironmentEnum[process.env.MICROS_ENV || EnvironmentEnum.development],
	MICROS_SERVICE_VERSION: process.env.MICROS_SERVICE_VERSION,
	NODE_ENV: nodeEnv,
	SENTRY_DSN: process.env.SENTRY_DSN,
	JIRA_LINK_TRACKING_ID: process.env.JIRA_LINK_TRACKING_ID,
	PROXY: getProxyFromEnvironment(),
} as EnvVars;

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
	LOG_LEVEL?: LogLevelString;
	SENTRY_DSN?: string,
	JIRA_LINK_TRACKING_ID?: string,
	PROXY?: string,
	LAUNCHDARKLY_KEY?: string;
	GIT_COMMIT_SHA: string;
	GIT_COMMIT_DATE: string;
	GIT_BRANCH_NAME: string;

	// Micros Lifecycle Env Vars
	SNS_NOTIFICATION_LIFECYCLE_QUEUE_URL?:string;
	SNS_NOTIFICATION_LIFECYCLE_QUEUE_NAME?:string;
	SNS_NOTIFICATION_LIFECYCLE_QUEUE_REGION?:string;
}
