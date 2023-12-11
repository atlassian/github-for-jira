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
	JIRA_ADMIN_CHECK = "jira-admin-check",
	LOG_CURLV_OUTPUT = "log-curlv-output",
	ENABLE_SUBSCRIPTION_DEFERRED_INSTALL = "enable-subscription-deferred-install",
	USE_REST_API_FOR_DISCOVERY = "use-rest-api-for-discovery-again",
	ENABLE_GITHUB_SECURITY_IN_JIRA = "enable-github-security-in-jira",
	DELETE_MESSAGE_ON_BACKFILL_WHEN_OTHERS_WORKING_ON_IT = "delete-message-on-backfill-when-others-working-on-it",
	ENABLE_5KU_BACKFILL_PAGE = "enable-5ku-experience-backfill-page",
	USE_DYNAMODB_TO_PERSIST_AUDIT_LOG = "use-dynamodb-to-persist-audit-log",
	USE_CUSTOM_ROOT_CA_BUNDLE = "use-custom-root-ca-bundle",
	GENERATE_CORE_HEAP_DUMPS_ON_LOW_MEM = "generate-core-heap-dumps-on-low-mem",
	USE_RATELIMIT_ON_JIRA_CLIENT = "use-ratelimit-on-jira-client",
	SKIP_PROCESS_QUEUE_IF_ISSUE_NOT_FOUND = "skip-process-queue-when-issue-not-exists"
}

export enum StringFlags {
	BLOCKED_INSTALLATIONS = "blocked-installations",
	LOG_LEVEL = "log-level",
	SEND_ALL = "send-all"
}

export enum NumberFlags {
	GITHUB_CLIENT_TIMEOUT = "github-client-timeout",
	SYNC_MAIN_COMMIT_TIME_LIMIT = "sync-main-commit-time-limit",
	PREEMPTIVE_RATE_LIMIT_THRESHOLD = "preemptive-rate-limit-threshold",
	NUMBER_OF_BUILD_PAGES_TO_FETCH_IN_PARALLEL = "number-of-build-to-fetch-in-parallel",
	BACKFILL_PAGE_SIZE = "backfill-page-size",
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
		return launchdarklyClient.variation(flag, user, defaultValue) as Promise<T>;
	} catch (err: unknown) {
		logger.error({ flag, err }, "Error resolving value for feature flag");
		return defaultValue;
	}
};

// Include jiraHost for any FF that needs to be rolled out in stages
export const booleanFlag = async (flag: BooleanFlags, key?: string): Promise<boolean> => {
	// Always use the default value as false to prevent issues
	return await getLaunchDarklyValue(flag, false, key);
};

export const stringFlag = async <T = string>(flag: StringFlags, defaultValue: T, key?: string): Promise<T> =>
	await getLaunchDarklyValue<T>(flag, defaultValue, key);

export const numberFlag = async (flag: NumberFlags, defaultValue: number, key?: string): Promise<number> =>
	await getLaunchDarklyValue(flag, defaultValue, key);

export const onFlagChange = (flag: BooleanFlags | StringFlags | NumberFlags, listener: () => void): void => {
	launchdarklyClient.on(`update:${flag}`, listener);
};

type ShouldSendAllStringTypes =
	"branches-backfill" | "builds-backfill" | "commits-backfill" | "deployments-backfill" | "prs-backfill" |
	"branches" | "builds" | "commits" | "deployments" | "prs";

export const shouldSendAll = async (type: ShouldSendAllStringTypes, jiraHost: string, logger: Logger): Promise<boolean> => {
	try {
		// Full set:
		// ["branches-backfill", "builds-backfill", "commits-backfill", "deployments-backfill", "prs-backfill", "branches", "builds", "commits", "deployments", "prs"]
		const sendAllString = await stringFlag(StringFlags.SEND_ALL, "[]", jiraHost);
		const sendAllArray: string[] = JSON.parse(sendAllString) as string[];
		return Array.isArray(sendAllArray) && sendAllArray.includes(type);
	} catch (e: unknown) {
		logger.error({ err: e, type }, "Cannot define if should send all");
		return false;
	}
};

export const isBlocked = async (jiraHost: string, installationId: number, logger: Logger): Promise<boolean> => {
	try {
		const blockedInstallationsString = await stringFlag(StringFlags.BLOCKED_INSTALLATIONS, "[]", jiraHost);
		const blockedInstallations: number[] = JSON.parse(blockedInstallationsString) as number[];
		return Array.isArray(blockedInstallations) && blockedInstallations.includes(installationId);
	} catch (e: unknown) {
		logger.error({ err: e, installationId }, "Cannot define if isBlocked");
		return false;
	}
};
