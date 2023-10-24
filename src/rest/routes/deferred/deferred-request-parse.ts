import { Request, Response } from "express";
import { errorWrapper } from "../../helper";
import {
	extractSubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { InvalidArgumentError, RestApiError } from "config/errors";
import { DeferralParsedRequest } from "rest-interfaces";

export const DeferredRequestParseRoute = errorWrapper("ParseRequestId", async function DeferredRequestParseRoute(req: Request, res: Response<DeferralParsedRequest>) {
	const requestId = req.params.requestId;
	if (!requestId) {
		req.log.warn("Missing requestId in query");
		throw new InvalidArgumentError("Missing requestId in query");
	}

	const deferredInstallPayload = await extractSubscriptionDeferredInstallPayload(requestId);

	if (deferredInstallPayload.jiraHost !== res.locals.jiraHost) {
		req.log.warn("Jirahost mismatch");
		throw new RestApiError(500, "JIRAHOST_MISMATCH", "Jirahost mismatch");
	}

	res.status(200).send({
		jiraHost: deferredInstallPayload.jiraHost as string,
		orgName: deferredInstallPayload.orgName
	});
});
