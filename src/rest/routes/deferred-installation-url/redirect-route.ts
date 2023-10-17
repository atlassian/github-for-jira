import { Router, Request, Response } from "express";
import { errorWrapper } from "../../helper";
import { GetDeferredInstallationUrl } from "rest-interfaces";
import { BaseLocals } from "..";
import { extractSubscriptionDeferredInstallPayload } from "services/subscription-deferred-install-service";
import { InvalidArgumentError } from "config/errors";
import { envVars } from "config/env";

export const DeferredInstallRequestRoute = Router({ mergeParams: true });

DeferredInstallRequestRoute.get("/", errorWrapper("DeferredInstallRequestRoute", async function DeferredInstallRequestRoute(req: Request, res: Response<GetDeferredInstallationUrl, BaseLocals>) {
	const requestId = req.params["requestId"];

	if (!requestId) {
		req.log.warn("Missing requestId");
		throw new InvalidArgumentError("Missing requestId");
	}

	const { gitHubInstallationId, jiraHost, orgName  } = await extractSubscriptionDeferredInstallPayload(requestId);

	return res.redirect(`${jiraHost}/plugins/servlet/ac/${envVars.APP_KEY}/spa-deferred-page?ac.gitHubInstallationId=${gitHubInstallationId}&ac.gitHubOrgName=${orgName}`);
}));
