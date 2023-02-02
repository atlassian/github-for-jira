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
	ASSOCIATE_PR_TO_ISSUES_IN_BODY = "associate-pr-to-issues-in-body",
	VERBOSE_LOGGING = "verbose-logging",
	REGEX_FIX = "regex-fix",
	USE_NEW_GITHUB_CLIENT_FOR_INSTALLATION_API = "use-new-github-client-for-installation-api",
	RETRY_ALL_ERRORS = "retry-all-errors",
	USE_REST_API_FOR_DISCOVERY = "use-rest-api-for-discovery",
	SEND_PR_COMMENTS_TO_JIRA = "send-pr-comments-to-jira_zy5ib",
	USE_REPO_ID_TRANSFORMER = "use-repo-id-transformer",
	USE_OUTBOUND_PROXY_FOR_OUATH_ROUTER = "use-outbound-proxy-for-oauth-router",
	SERVICE_ASSOCIATIONS_FOR_DEPLOYMENTS = "service-associations-for-deployments",
	ISSUEKEY_REGEX_CHAR_LIMIT = "issuekey-regex-char-limit",
	USE_SHARED_PR_TRANSFORM = "use-shared-pr-transform",
	NEW_JWT_VALIDATION = "new-jwt-validation",
	RELAX_GHE_URLS_CHECK = "relax-ghe-url-check",
	RENEW_GITHUB_TOKEN = "renew-github-token"
}

export enum StringFlags {
	BLOCKED_INSTALLATIONS = "blocked-installations",
	LOG_LEVEL = "log-level",
	OUTBOUND_PROXY_SKIPLIST = "outbound-proxy-skiplist"
}

export enum NumberFlags {
	GITHUB_CLIENT_TIMEOUT = "github-client-timeout",
	SYNC_MAIN_COMMIT_TIME_LIMIT = "sync-main-commit-time-limit",
	SYNC_BRANCH_COMMIT_TIME_LIMIT = "sync-branch-commit-time-limit",
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

export const numberFlag = async (flag: NumberFlags, defaultValue: number, key?: string): Promise<number> =>
	await getLaunchDarklyValue(flag, defaultValue, key);

export const onFlagChange = (flag: BooleanFlags | StringFlags | NumberFlags, listener: () => void): void => {
	launchdarklyClient.on(`update:${flag}`, listener);
};

export const isBlocked = async (installationId: number, logger: Logger): Promise<boolean> => {
	try {
		const blockedInstallationsString = await stringFlag(StringFlags.BLOCKED_INSTALLATIONS, "[]");
		const blockedInstallations: number[] = JSON.parse(blockedInstallationsString);
		return blockedInstallations.includes(installationId);
	} catch (e) {
		logger.error({ err: e, installationId }, "Cannot define if isBlocked");
		return false;
	}
};
