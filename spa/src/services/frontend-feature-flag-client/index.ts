import FeatureFlagWebClient, {
	GetValueOptions,
	Identifiers,
	SupportedFlagTypes
} from "@atlassiansox/feature-flag-web-client";
import createAnalyticsClient from "./analytics-client";

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
		value: HASHED_JIRAHOST,
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

export default class FrontendFeatureFlagClient {
	private fffClient: FeatureFlagWebClient | undefined;

	async init() {
		if (!this.fffClient) {
			this.fffClient = new FeatureFlagWebClient(
				apiKeys(),
				createAnalyticsClient(),
				featureFlagUser,
				options
			);
		}
	}

	getFlagValue<T extends SupportedFlagTypes>(flagKey: string, defaultValue: T, options?: GetValueOptions<T>): T {
		return this.fffClient ? this.fffClient.getFlagValue(flagKey, defaultValue, options) : defaultValue;
	}
}
