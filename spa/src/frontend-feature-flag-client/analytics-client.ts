import AnalyticsClient, { userType } from "@atlassiansox/analytics-web-client";

export default () => {
	const client = new AnalyticsClient(
		{
			env: SPA_APP_ENV,
			product: "githubForJira",
		}, {
			useLegacyUrl: true
		}
	);
	client.setUserInfo(userType.ATLASSIAN_ACCOUNT, HASHED_JIRAHOST);
	return client;
};
