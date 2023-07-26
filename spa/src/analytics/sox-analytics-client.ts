import { AnalyticClient, UIEventOpts, ScreenEventOpts, TrackEventOpts } from "./types";
import { getUserContext, UserContext } from "./context";

export const loadSoxAnalyticClient = function(): AnalyticClient | undefined {

	try {
		/*eslint-disable @typescript-eslint/no-var-requires*/
		const imported = require("@atlassiansox/analytics-web-client");
		if(imported && imported.default) {
			const client = new imported.default(
				{
					env: SPA_APP_ENV,
					product: "github-for-jira",
				},
				{
					useLegacyUrl: true // due to do not have stargate gateway setup for this product
				}
			);

			getUserContext()
				.then((userContext: UserContext | undefined) => {
					if (userContext) {
						client.setTenantInfo(imported.tenantType.CLOUD_ID, userContext.tenantId);
						client.setUserInfo(imported.userType.ATLASSIAN_ACCOUNT, userContext.accountId);
						client.setUIViewedAttributes({ clientKey: userContext.clientKey });
						console.info("analytis loaded");
					}
				})
				.catch((e) => { console.error("fail setting user context", e); });

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
	} catch (e) {
		//do nothing, TODO: do proper logging?
		console.error("fail initialize sox analytics client", e);
		return undefined;
	}

};
