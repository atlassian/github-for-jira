import LaunchDarkly, {LDClient, LDLogger, LDUser} from "launchdarkly-node-server-sdk";
import crypto from "crypto";
import {getLogger} from "./logger";
import Logger from "bunyan";

const logger = getLogger("feature-flags");

/**
 * Abstraction over the actual feature flag provider so we can
 * multiple implementations.
 */
interface FeatureFlagResolver {
	booleanValue(flag: string, jiraHost: string, defaultValue: boolean): Promise<boolean>;
}

/**
 * A no-op feature flag resolver that always returns the default value.
 */
class NoopFeatureFlagResolver implements FeatureFlagResolver {
	booleanValue(_: string, __: string, defaultValue: boolean): Promise<boolean> {
		return Promise.resolve(defaultValue);
	}
}

/**
 * A feature flag resolver that resolves feature flags against the LaunchDarkly server.
 * Uses the SHA-1 hash of the Jira Host URL to identify a user in LaunchDarkly (because
 * we don't want to send the plain URL to LaunchDarkly). If you want to target specific
 * Jira sites, you can create a SHA-1 hash on https://www.fileformat.info/tool/hash.htm.
 */
class LaunchdarklyFeatureFlagResolver implements FeatureFlagResolver {

	private launchdarklyClient: LDClient;

	async initWithLaunchdarklyKey(launchdarklyKey: string): Promise<void> {
		try {
			this.launchdarklyClient = LaunchDarkly.init(launchdarklyKey, {
				logger: new LaunchDarklyLogger()
			});
			await this.launchdarklyClient.waitForInitialization();
		} catch (e) {
			throw new Error(`Failed to wait for LD Client initialization: ${e}`);
		}
	}

	/**
	 * Creates a LaunchDarkly user using the hash value of the user's Jira host URL.
	 * We don't want to send the plain Jira host URL to LaunchDarkly, because it's
	 * considered personal data, so we hash it instead.
	 */
	createLaunchDarklyUser(jiraHost: string): LDUser {
		const hash = crypto.createHash("sha1");
		hash.update(jiraHost)
		const hashAsHex = hash.digest("hex");
		return {
			key: hashAsHex
		}
	}

	booleanValue(flag: string, jiraHost: string, defaultValue: boolean): Promise<boolean> {
		const user = this.createLaunchDarklyUser(jiraHost);
		return this.launchdarklyClient.variation(flag, user, defaultValue);
	}

}

/**
 * Translating LaunchDarkly log events to our logging library.
 * Otherwise, LaunchDarkly would log everything to standard out.
 */
class LaunchDarklyLogger implements LDLogger {

	private launchDarklyLogger: Logger = getLogger("launchdarkly");

	debug(...args: any[]): void {
		this.launchDarklyLogger.debug(args);
	}

	error(...args: any[]): void {
		this.launchDarklyLogger.error(args);
	}

	info(...args: any[]): void {
		this.launchDarklyLogger.info(args);
	}

	warn(...args: any[]): void {
		this.launchDarklyLogger.warn(args);
	}
}

/**
 * Bundles all feature flag into an object that we can ask to evaluate a feature flag for a given Jira Host.
 * The Jira Host is expected to be the full Jira url, i.e. something like "https://myjira.atlassian.net".
 */
export class FeatureFlags {

	private featureflagResolver: FeatureFlagResolver;

	constructor(featureflagResolver: FeatureFlagResolver) {
		this.featureflagResolver = featureflagResolver;
	}

	/**
	 * Returns true if the maintenance mode is enabled for the given Jira host URL.
	 */
	async isMaintenanceMode(jiraHost: string): Promise<boolean> {
		return this.featureflagResolver.booleanValue("maintenance-mode", jiraHost, false);
	}

}

export let featureFlags: FeatureFlags;

export async function initFeatureFlags(launchdarklyKey?: string) {
	if (launchdarklyKey) {
		featureFlags = await initFeatureFlagsWithLaunchdarklyKey(launchdarklyKey);
	} else {
		featureFlags = await initWithNoopResolver();
	}
}

async function initWithNoopResolver(): Promise<FeatureFlags> {
	const resolver = new NoopFeatureFlagResolver();
	const flags = new FeatureFlags(resolver);
	logger.error("Warning! Using no-op feature flags that always resolve to their default values! Should only be used in local development.");
	return flags;
}

async function initFeatureFlagsWithLaunchdarklyKey(launchdarklyKey: string): Promise<FeatureFlags> {
	const resolver = new LaunchdarklyFeatureFlagResolver();
	await resolver.initWithLaunchdarklyKey(launchdarklyKey);
	const flags = new FeatureFlags(resolver);
	logger.info("Successfully initialized LaunchDarkly client!");
	return flags;
}

