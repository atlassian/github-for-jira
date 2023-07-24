type UIEvent = "trigger-authorisation";

export type AnalyticClient = {
	sendUIEvent: (event: UIEvent) => void
};

const analyticsClient: AnalyticClient = {
	sendUIEvent: () => {}
};

try {
	/*eslint-disable @typescript-eslint/no-var-requires*/
	const imported = require("@atlassiansox/analytics-web-client");
	if(imported) {
		const client = new imported.AnalyticsWebClient(
			{
				env: imported.envType.DEV,
				product: "github-for-jira",
			},
			{
				useLegacyUrl: true // due to do not have stargate gateway setup for this product
			}
		);
		analyticsClient.sendUIEvent = function () {
			client.sendUIEvent({
			});
		};
	}
} catch (_) {
	//do nothing, TODO: do proper logging?
}

export default analyticsClient;

