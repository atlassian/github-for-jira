import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "path";
import { LogLevelString } from "bunyan";
import { getNodeEnv } from "utils/is-node-env";
import { EnvironmentEnum, MicrosEnvTypeEnum } from "interfaces/common";
import { envCheck } from "utils/env-utils";

const nodeEnv: EnvironmentEnum = getNodeEnv();

// Load environment files
[
	`.env.${nodeEnv}.local`,
	`.env.local`,
	`.env.${nodeEnv}`,
	".env"
].map((env) => expand(config({
	path: path.resolve(process.cwd(), env)
})));

type Transforms<T, K extends keyof T = keyof T> = {
	[P in K]?: (value?: string) => T[P];
};

const transforms: Transforms<EnvVars> = {
	MICROS_ENV: (value?: string) =>  EnvironmentEnum[value || ""] as EnvironmentEnum | undefined || EnvironmentEnum.development,
	MICROS_GROUP: (value?: string) => value || "",
	NODE_ENV: () => nodeEnv,
	S3_DUMPS_BUCKET_NAME: (value?: string) => value ?? "",
	S3_DUMPS_BUCKET_PATH: (value?: string) => value ?? "",
	S3_DUMPS_BUCKET_REGION: (value?: string) => value ?? "",
	PROXY: () => {
		const proxyHost = process.env.EXTERNAL_ONLY_PROXY_HOST;
		const proxyPort = process.env.EXTERNAL_ONLY_PROXY_PORT;
		return proxyHost && proxyPort ? `http://${proxyHost}:${proxyPort}` : undefined;
	},
	WEBHOOK_SECRETS: (value?: string): Array<string> => {
		try {
			const parsed = value ? JSON.parse(value) as Array<string> : undefined;
			if (!parsed) {
				return [];
			}
			if (!Array.isArray(parsed)) {
				return [parsed];
			}
			return parsed;
		} catch {
			if (value) {
				return [value];
			} else {
				return [];
			}
		}
	},
	GITHUB_REPO_URL: (value?: string) => value || "https://github.com/atlassian/github-for-jira"
};

// Create proxy for `process.env`
export const envVars: EnvVars = new Proxy<object>({}, {
	get(_target: object, prop: keyof EnvVars) {
		// get from process.env directly since the whole env object might be replaced
		const value = process.env[prop];
		return transforms[prop]?.(value) || value;
	}
}) as EnvVars;

envCheck(
	"APP_ID",
	"APP_URL",
	"APP_KEY",
	"WEBHOOK_SECRETS",
	"COOKIE_SESSION_KEY",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
	"SQS_BACKFILL_QUEUE_URL",
	"SQS_BACKFILL_QUEUE_REGION",
	"SQS_PUSH_QUEUE_URL",
	"SQS_PUSH_QUEUE_REGION",
	"SQS_DEPLOYMENT_QUEUE_URL",
	"SQS_DEPLOYMENT_QUEUE_REGION",
	"SQS_BRANCH_QUEUE_URL",
	"SQS_BRANCH_QUEUE_REGION",
	"SQS_INCOMINGANALYTICEVENTS_QUEUE_URL",
	"SQS_INCOMINGANALYTICEVENTS_QUEUE_REGION",
	"DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_REGION",
	"DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME",
	"MICROS_AWS_REGION",
	"GLOBAL_HASH_SECRET",
	"CRYPTOR_URL",
	"CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE",
	"MICROS_PLATFORM_STATSD_HOST",
	"MICROS_PLATFORM_STATSD_PORT"
);

export interface EnvVars {
	NODE_ENV: EnvironmentEnum,
	MICROS_ENV: EnvironmentEnum;
	MICROS_ENVTYPE: MicrosEnvTypeEnum | undefined,
	MICROS_SERVICE_VERSION?: string;
	MICROS_GROUP: string;
	SQS_BACKFILL_QUEUE_URL: string;
	SQS_BACKFILL_QUEUE_REGION: string;
	SQS_PUSH_QUEUE_URL: string;
	SQS_PUSH_QUEUE_REGION: string;
	SQS_DEPLOYMENT_QUEUE_URL: string;
	SQS_DEPLOYMENT_QUEUE_REGION: string;
	SQS_BRANCH_QUEUE_URL: string;
	SQS_BRANCH_QUEUE_REGION: string;
	SQS_INCOMINGANALYTICEVENTS_QUEUE_URL: string;
	SQS_INCOMINGANALYTICEVENTS_QUEUE_REGION: string;

	APP_ID: string;
	APP_URL: string;
	APP_KEY: string;
	WEBHOOK_SECRETS: Array<string>;
	COOKIE_SESSION_KEY: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	DATABASE_URL: string;
	STORAGE_SECRET: string;
	PRIVATE_KEY_PATH: string;
	PRIVATE_KEY: string;
	ATLASSIAN_URL: string;
	WEBHOOK_PROXY_URL: string;
	MICROS_AWS_REGION: string;
	TUNNEL_PORT?: string;
	TUNNEL_SUBDOMAIN?: string;
	LOG_LEVEL?: LogLevelString;
	SENTRY_DSN?: string,
	SENTRY_SPA_DSN?: string,
	JIRA_LINK_TRACKING_ID?: string,
	PROXY?: string,
	LAUNCHDARKLY_KEY?: string;
	GIT_COMMIT_SHA?: string;
	GIT_COMMIT_DATE?: string;
	GIT_BRANCH_NAME?: string;
	GITHUB_REPO_URL: string;
	DEPLOYMENT_DATE: string;
	GLOBAL_HASH_SECRET: string;

	//DyamoDB for deployment status history
	DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_REGION: string;
	DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME: string;
	DYNAMO_AUDIT_LOG_TABLE_NAME: string;
	DYNAMO_AUDIT_LOG_TABLE_REGION: string;

	// Micros Lifecycle Env Vars
	SNS_NOTIFICATION_LIFECYCLE_QUEUE_URL?: string;
	SNS_NOTIFICATION_LIFECYCLE_QUEUE_NAME?: string;
	SNS_NOTIFICATION_LIFECYCLE_QUEUE_REGION?: string;

	// Cryptor
	CRYPTOR_URL: string;
	CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE: string;

	REDISX_CACHE_PORT: string;
	REDISX_CACHE_HOST: string;
	REDISX_CACHE_TLS_ENABLED?: string;

	MICROS_PLATFORM_STATSD_HOST: string;
	MICROS_PLATFORM_STATSD_PORT: string;

	JIRA_TEST_SITES: string;

	S3_DUMPS_BUCKET_NAME: string;
	S3_DUMPS_BUCKET_PATH: string;
	S3_DUMPS_BUCKET_REGION: string;
}
