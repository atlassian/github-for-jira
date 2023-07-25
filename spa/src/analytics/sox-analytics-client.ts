import { AnalyticClient, UIEventOpts, ScreenEventOpts, TrackEventOpts } from "./types";

export const loadSoxAnalyticClient = function(): AnalyticClient | undefined {

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
			return {
				sendScreenEvent: function(opts: ScreenEventOpts) {
					client.sendScreenEvent({
						name: opts.name,
						attributes: {
							...opts.attributes
						}
					});
				},
				sendUIEvent: function (opts: UIEventOpts) {
					client.sendUIEvent({
						actionSubject: opts.actionSubject,
						action: opts.action,
						source: "spa",
						attributes: {
							...opts.attributes
						}
					});
				},
				sendTrackEvent: function (opts: TrackEventOpts) {
					client.sendTrackEvent({
						actionSubject: opts.actionSubject,
						action: opts.action,
						source: "spa",
						attributes: {
							...opts.attributes
						}
					});
				}
			};
		}
	} catch (_) {
		//do nothing, TODO: do proper logging?
		return undefined;
	}

}
