
import LaunchDarkly, { LDUser } from "launchdarkly-node-server-sdk";
import { getLogger } from "./logger";
import envVars from "./env";
import crypto from "crypto";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

const logger = getLogger("feature-flags");

const launchdarklyClient = LaunchDarkly.init(envVars.LAUNCHDARKLY_KEY || "", {
	offline: !envVars.LAUNCHDARKLY_KEY,
	logger
});

export enum BooleanFlags {
	MAINTENANCE_MODE = "maintenance-mode",
	SIMPLER_PROCESSOR = "simpler-processor",
	USE_NEW_GITHUB_CLIENT__FOR_PR = "git-hub-client-for-pullrequests",
	SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_DEPLOYMENTS = "support-branch-and-merge-workflows-for-deployments",
	TRACE_LOGGING = "trace-logging",
	USE_SQS_FOR_BRANCH = "use-sqs-for-branch",
	ASSOCIATE_PR_TO_ISSUES_IN_BODY = "associate-pr-to-issues-in-body",
	VERBOSE_LOGGING = "verbose-logging",
	USE_NEW_GITHUB_CLIENT_FOR_BRANCHES = "use-new-github-client-for-branches",
	USE_NEW_GITHUB_CLIENT_FOR_DISCOVERY = "use-new-github-client-for-discovery",
	USE_NEW_GITHUB_CLIENT_FOR_DEPLOYMENTS = "use-new-github-client-for-deployments",
	USE_NEW_GITHUB_CLIENT_FOR_WORKFLOW_WEBHOOK = "use-new-github-client-for-workflow-webhook",
	USE_NEW_GITHUB_CLIENT_FOR_PULL_REQUEST_WEBHOOK = "use-new-github-client-for-pull-request-webhook",
	USE_NEW_GITHUB_CLIENT_FOR_BACKFILL = "use-new-github-client-for-backfill_z7ps8",
	USE_NEW_GITHUB_PULL_REQUEST_URL_FORMAT = "use-new-github-pull-request-url-format"
}

export enum StringFlags {
	BLOCKED_INSTALLATIONS = "blocked-installations"
}

export enum NumberFlags {
	GITHUB_CLIENT_TIMEOUT = "github-client-timeout"
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

const getLaunchDarklyValue = async (flag: BooleanFlags | StringFlags | NumberFlags, defaultValue: boolean | string | number, jiraHost?: string): Promise<boolean | string | number> => {
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

export const numberFlag = async (flag: NumberFlags, defaultValue: number, jiraHost?: string): Promise<number> =>
	Number(await getLaunchDarklyValue(flag, defaultValue, jiraHost));

export const isBlocked = async (installationId: number, logger: LoggerWithTarget): Promise<boolean> => {
	try {
		const blockedInstallationsString = await stringFlag(StringFlags.BLOCKED_INSTALLATIONS, "[]");
		const blockedInstallations: number[] = JSON.parse(blockedInstallationsString);
		return blockedInstallations.includes(installationId);
	} catch (e) {
		logger.error({ err: e, installationId }, "Cannot define if isBlocked");
		return false;
	}
};
