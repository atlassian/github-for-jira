
import LaunchDarkly, { LDUser } from "launchdarkly-node-server-sdk";
import { getLogger } from "./logger";
import envVars from "./env";
import crypto from "crypto";
import {LoggerWithTarget} from "probot/lib/wrap-logger";

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
	NEW_GITHUB_ERROR_PAGE = "new-git-hub-error-page",
	NEW_BACKFILL_PROCESS_ENABLED = "new-backfill-process-enabled",
	// When cleaning up the SEND_PUSH_TO_SQS feature flag, please also clean up the PRIORITIZE_PUSHES
	// feature flag, because it doesn't make sense with SQS any more.
	SEND_PUSH_TO_SQS = "send-push-events-to-sqs",
	PRIORITIZE_PUSHES = "prioritize-pushes",
	USE_NEW_GITHUB_CLIENT__FOR_PR = "git-hub-client-for-pullrequests",
	NEW_REPO_SYNC_STATE = "new-repo-sync-state",
	TRACE_LOGGING = "trace-logging",
	USE_SQS_FOR_BACKFILL = "use-sqs-for-backfill",
	USE_NEW_GITHUB_CLIENT_FOR_PUSH = "use-new-github-client-for-push"
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

export const isBlocked = async (installationId: number, logger: LoggerWithTarget): Promise<boolean> => {
	try {
		const blockedInstallationsString = await stringFlag(StringFlags.BLOCKED_INSTALLATIONS, "[]");
		const blockedInstallations: number[] = JSON.parse(blockedInstallationsString);
		return blockedInstallations.includes(installationId);
	} catch (e) {
		logger.error({ err: e, installationId }, "Cannot define if isBlocked")
		return false;
	}
};
