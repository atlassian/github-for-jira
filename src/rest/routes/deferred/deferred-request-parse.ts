import { Request, Response } from "express";
import { errorWrapper } from "../../helper";
import {
	extractSubscriptionDeferredInstallPayload,
	SubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { InvalidArgumentError } from "config/errors";

export const DeferredRequestParseRoute = errorWrapper("ParseRequestId", async function DeferredRequestParseRoute(req: Request, res: Response<SubscriptionDeferredInstallPayload>) {
	const requestId = req.params.requestId;
	if (!requestId) {
		req.log.warn("Missing requestId in query");
		throw new InvalidArgumentError("Missing requestId in query");
	}

	const deferredInstallPayload = await extractSubscriptionDeferredInstallPayload(requestId);

	res.status(200).send(deferredInstallPayload);
});
