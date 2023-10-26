import { Request, Response } from "express";
import { errorWrapper } from "../../helper";
import {
	extractSubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { InvalidArgumentError } from "config/errors";
import { DeferralParsedRequest } from "rest-interfaces";

export const DeferredRequestParseRoute = errorWrapper("ParseRequestId", async function DeferredRequestParseRoute(req: Request, res: Response<DeferralParsedRequest>) {
	const requestId = req.params.requestId;
	if (!requestId) {
		req.log.warn("Missing requestId in query");
		throw new InvalidArgumentError("Missing requestId in query");
	}

	const deferredInstallPayload = await extractSubscriptionDeferredInstallPayload(requestId);

	res.status(200).send({
		jiraHost: deferredInstallPayload.jiraHost as string,
		orgName: deferredInstallPayload.orgName
	});
});
