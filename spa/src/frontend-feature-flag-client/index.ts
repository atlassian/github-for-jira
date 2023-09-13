import FeatureFlagWebClient, { Identifiers } from "@atlassiansox/feature-flag-web-client";
import createAnalyticsClient from "./analytics-client";

let featureFlagClient: FeatureFlagWebClient | null = null;

// TODO: Hard code these values
const apiKeys = () => {
	switch (SPA_APP_ENV) {
		case "prod":
			return "PROD_KEY";
		case "staging":
			return "STAGING_KEY";
		default:
			return "LOCAL_KEY";
	}
};

const featureFlagUser = {
	isAnonymous: false,
	identifier: {
		type: Identifiers.ATLASSIAN_ACCOUNT_ID,
		value: ATLASSIAN_ACCOUNT_ID,
	},
	custom: {
		user: {
			key: HASHED_JIRAHOST
		}
	}
};

const options = {
	productKey: "githubForJira",
	environment: SPA_APP_ENV
};

export const getFeatureFlagClient = async (): Promise<FeatureFlagWebClient> => {
	if (featureFlagClient === null) {
		const fffClient = new FeatureFlagWebClient(
			apiKeys(),
			createAnalyticsClient(),
			featureFlagUser,
			options
		);
		await fffClient.ready();
		featureFlagClient = fffClient;
		return featureFlagClient;
	} else {
		return featureFlagClient;
	}
};

export const getBooleanFlagValue = (flagName: string, defaultValue = false): boolean =>
	featureFlagClient ? featureFlagClient.getFlagValue(flagName, defaultValue) : defaultValue;
