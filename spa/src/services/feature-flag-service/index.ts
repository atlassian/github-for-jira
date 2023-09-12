import FeatureFlagWebClient from "@atlassiansox/feature-flag-web-client";

const analyticsWebClient = {};

const featureFlagUser = {
	isAnonymous: false,
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

const FeatureFlagService = new FeatureFlagWebClient(
	FFF_API_KEY,
	analyticsWebClient,
	featureFlagUser,
	options
);

export default {
	isReady: FeatureFlagService.ready(),
	service: FeatureFlagService
};
