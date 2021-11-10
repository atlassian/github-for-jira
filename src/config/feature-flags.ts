
import LaunchDarkly, { LDUser } from "launchdarkly-node-server-sdk";
import { getLogger } from "./logger";
import envVars from "./env";
import crypto from "crypto";

const logger = getLogger("feature-flags");

const launchdarklyClient = LaunchDarkly.init(envVars.LAUNCHDARKLY_KEY || "", {
	offline: !envVars.LAUNCHDARKLY_KEY,
	logger
});

export enum BooleanFlags {
	MAINTENANCE_MODE = "maintenance-mode",
	EXPOSE_QUEUE_METRICS = "expose-queue-metrics",
	PROCESS_PUSHES_IMMEDIATELY = "process-pushes-immediately",
	SIMPLER_PROCESSOR = "simpler-processor",
	RETRY_WITHOUT_CHANGED_FILES = "retry-without-changed-files",
	NEW_GITHUB_CONFIG_PAGE = "new-github-config-page",
	NEW_CONNECT_AN_ORG_PAGE = "new-connect-an-org-page",
	NEW_GITHUB_ERROR_PAGE = "new-git-hub-error-page",
	NEW_SETUP_PAGE = "new-setup-page",
	SORT_INSTALLATIONS_BY_ID = "sort-installations-by-id",
	NEW_BACKFILL_PROCESS_ENABLED = "new-backfill-process-enabled",
	USE_DEDUPLICATOR_FOR_BACKFILLING = "use-deduplicator-for-backfilling",

	// When cleaning up the SEND_PUSH_TO_SQS feature flag, please also clean up the PRIORITIZE_PUSHES
	// feature flag, because it doesn't make sense with SQS any more.
	SEND_PUSH_TO_SQS = "send-push-events-to-sqs",
	PRIORITIZE_PUSHES = "prioritize-pushes",
}

export enum StringFlags {
	BLOCKED_INSTALLATIONS = "blocked-installations"
}

const createLaunchdarklyUser = (jiraHost?: string): LDUser => {
	if (!jiraHost) {
		return {
			key: "global"
		};
	}

	const hash = crypto.createHash("sha1");
	hash.update(jiraHost);

	return {
		key: hash.digest("hex")
	};
};

const getLaunchDarklyValue = async (flag: BooleanFlags | StringFlags, defaultValue: boolean | string, jiraHost?: string): Promise<boolean | string> => {
	try {
		await launchdarklyClient.waitForInitialization();
		const user = createLaunchdarklyUser(jiraHost);
		return launchdarklyClient.variation(flag, user, defaultValue);
	} catch (err) {
		logger.error({ flag, err }, "Error resolving value for feature flag");
		return defaultValue;
	}
};

// Include jiraHost for any FF that needs to be rolled out in stages
export const booleanFlag = async (flag: BooleanFlags, defaultValue: boolean, jiraHost?: string): Promise<boolean> =>
	Boolean(await getLaunchDarklyValue(flag, defaultValue, jiraHost));

export const stringFlag = async (flag: StringFlags, defaultValue: string, jiraHost?: string): Promise<string> =>
	String(await getLaunchDarklyValue(flag, defaultValue, jiraHost));
