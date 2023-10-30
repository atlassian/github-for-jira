import { Request, Response } from "express";
import { errorWrapper } from "../../helper";
import {
	extractSubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { InvalidArgumentError } from "config/errors";
import { DeferralParsedRequest } from "rest-interfaces";
import maskString from "utils/mask-string";

export const DeferredRequestParseRoute = errorWrapper("ParseRequestId", async function DeferredRequestParseRoute(req: Request, res: Response<DeferralParsedRequest>) {
	const requestId = req.params.requestId;
	if (!requestId) {
		req.log.warn("Missing requestId in query");
		throw new InvalidArgumentError("Missing requestId in query");
	}

	const { jiraHost, orgName } = await extractSubscriptionDeferredInstallPayload(requestId);
	if (!jiraHost) {
		throw new Error("No jiraHost");
	}

	const host = new URL(jiraHost).hostname.split(".")[0];
	const maskedHost = maskString(host);
	const maskedOrgName = maskString(orgName);

	res.status(200).send({
		jiraHost: `https://${maskedHost}.atlassian.net`,
		orgName: maskedOrgName
	});
});
