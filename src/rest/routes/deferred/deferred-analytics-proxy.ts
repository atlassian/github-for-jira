import { InvalidArgumentError } from "config/errors";
import { extractSubscriptionDeferredInstallPayload } from "services/subscription-deferred-install-service";
import { AnalyticsProxyHandler } from "~/src/rest/routes/analytics-proxy";
import { RequestHandler } from "express";

/**
 * This handler simply gets the `jiraHost` from the `requestId`
 * and re-uses the existing `AnalyticsProxyHandler`
 */
const DeferredAnalyticsProxy = (async (req, res, next) => {
	const requestId = req.params.requestId;
	if (!requestId) {
		req.log.warn("Missing requestId in query");
		throw new InvalidArgumentError("Missing requestId in query");
	}

	const { jiraHost } = await extractSubscriptionDeferredInstallPayload(requestId);
	res.locals.jiraHost = jiraHost;

	AnalyticsProxyHandler(req, res, next);
}) as RequestHandler;

export default DeferredAnalyticsProxy;
