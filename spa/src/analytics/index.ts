export type UIEventOpts = {
	actionSubject: string,
	action: string
};

export type AnalyticClient = {
	sendUIEvent: (event: UIEventOpts) => void
};

const analyticsClient: AnalyticClient = {
	sendUIEvent: () => {}
};

try {
	/*eslint-disable @typescript-eslint/no-var-requires*/
	const imported = require("@atlassiansox/analytics-web-client");
	if(imported && imported.default) {
		console.info("analytis loaded");
		const client = new imported.default(
			{
				env: imported.envType.DEV,
				product: "github-for-jira",
			},
			{
				useLegacyUrl: true // due to do not have stargate gateway setup for this product
			}
		);
		analyticsClient.sendUIEvent = function (opts: UIEventOpts) {
			client.sendUIEvent({
				actionSubject: opts.actionSubject,
				action: opts.action,
				source: "spa"
			});
		};
	}
} catch (_) {
	//do nothing, TODO: do proper logging?
}

export default analyticsClient;

