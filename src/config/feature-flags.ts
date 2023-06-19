import LaunchDarkly, { LDUser } from "launchdarkly-node-server-sdk";
import { getLogger } from "./logger";
import { envVars } from "./env";
import { createHashWithSharedSecret } from "utils/encryption";
import Logger from "bunyan";

const logger = getLogger("feature-flags", { level: "warn" });

const launchdarklyClient = LaunchDarkly.init(envVars.LAUNCHDARKLY_KEY || "", {
	offline: !envVars.LAUNCHDARKLY_KEY,
	logger
});

export enum BooleanFlags {
	MAINTENANCE_MODE = "maintenance-mode",
	VERBOSE_LOGGING = "verbose-logging",
	SEND_PR_COMMENTS_TO_JIRA = "send-pr-comments-to-jira_zy5ib",
	REPO_CREATED_EVENT = "repo-created-event",
	JIRA_ADMIN_CHECK = "jira-admin-check",
	REMOVE_STALE_MESSAGES = "remove-stale-messages",
	USE_NEW_PULL_ALGO = "use-new-pull-algo",
	ENABLE_API_KEY_FEATURE = "enable-api-key-feature",
	USE_DYNAMODB_FOR_DEPLOYMENT_WEBHOOK = "use-dynamodb-for-deployment-webhook",
	USE_DYNAMODB_FOR_DEPLOYMENT_BACKFILL = "use-dynamodb-for-deployment-backfill",
	LOG_CURLV_OUTPUT = "log-curlv-output",
	SKIP_REQUESTED_REVIEWERS = "skip-requested-reviewers",
	ENABLE_SUBSCRIPTION_DEFERRED_INSTALL = "enable-subscription-deferred-install",
	TEMP_LOG_REQ_URL_TO_DEBUG_GENERIC_CONTAINERS = "temp-log-req-url-to-debug-generic-containers"
}

export enum StringFlags {
	GITHUB_SCOPES = "github-scopes",
	BLOCKED_INSTALLATIONS = "blocked-installations",
	LOG_LEVEL = "log-level",
	HEADERS_TO_ENCRYPT = "headers-to-encrypt",
	GHE_API_KEY = "ghe-encrypted-api-key"
}

export enum NumberFlags {
	GITHUB_CLIENT_TIMEOUT = "github-client-timeout",
	SYNC_MAIN_COMMIT_TIME_LIMIT = "sync-main-commit-time-limit",
	PREEMPTIVE_RATE_LIMIT_THRESHOLD = "preemptive-rate-limit-threshold",
	NUMBER_OF_PR_PAGES_TO_FETCH_IN_PARALLEL = "number-of-pr-pages-to-fetch-in-parallel",
	NUMBER_OF_BUILD_PAGES_TO_FETCH_IN_PARALLEL = "number-of-build-to-fetch-in-parallel",
	BACKFILL_PAGE_SIZE = "backfill-page-size",
	BACKFILL_DEPLOYMENT_EXTRA_PAGES = "backfill-deployment-extra-pags",
	BACKFILL_MAX_SUBTASKS = "backfill-max-subtasks",
	INSTALLATION_TOKEN_CACHE_MAX_SIZE = "installation-token-cache-max-size"
}

const createLaunchdarklyUser = (key?: string): LDUser => {
	if (!key) {
		return {
			key: "global"
		};
	}

	return {
		key: createHashWithSharedSecret(key)
	};
};

const getLaunchDarklyValue = async <T = boolean | string | number>(flag: BooleanFlags | StringFlags | NumberFlags, defaultValue: T, key?: string): Promise<T> => {
	try {
		await launchdarklyClient.waitForInitialization();
		const user = createLaunchdarklyUser(key);
		return launchdarklyClient.variation(flag, user, defaultValue);
	} catch (err) {
		logger.error({ flag, err }, "Error resolving value for feature flag");
		return defaultValue;
	}
};

// Include jiraHost for any FF that needs to be rolled out in stages
export const booleanFlag = async (flag: BooleanFlags, key?: string): Promise<boolean> =>
	// Always use the default value as false to prevent issues
	await getLaunchDarklyValue(flag, false, key);

export const stringFlag = async <T = string>(flag: StringFlags, defaultValue: T, key?: string): Promise<T> =>
	await getLaunchDarklyValue<T>(flag, defaultValue, key);

export const numberFlag = async (flag: NumberFlags, defaultValue: number, key?: string): Promise<number> => {
	if (flag === NumberFlags.BACKFILL_DEPLOYMENT_EXTRA_PAGES) return 5;
	return await getLaunchDarklyValue(flag, defaultValue, key);
};

export const onFlagChange = (flag: BooleanFlags | StringFlags | NumberFlags, listener: () => void): void => {
	launchdarklyClient.on(`update:${flag}`, listener);
};

export const isBlocked = async (jiraHost: string, installationId: number, logger: Logger): Promise<boolean> => {
	try {
		const blockedInstallationsString = await stringFlag(StringFlags.BLOCKED_INSTALLATIONS, "[]", jiraHost);
		const blockedInstallations: number[] = JSON.parse(blockedInstallationsString);
		return blockedInstallations.includes(installationId);
	} catch (e) {
		logger.error({ err: e, installationId }, "Cannot define if isBlocked");
		return false;
	}
};
