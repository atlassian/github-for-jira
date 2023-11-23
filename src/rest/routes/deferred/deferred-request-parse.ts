import { Request, Response } from "express";
import { errorWrapper } from "../../helper";
import {
	extractSubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { InsufficientPermissionError, InvalidArgumentError } from "config/errors";
import { DeferralParsedRequest } from "rest-interfaces";
import { hasAdminAccess } from "services/subscription-installation-service";

export const DeferredRequestParseRoute = errorWrapper("ParseRequestId", async function DeferredRequestParseRoute(req: Request, res: Response<DeferralParsedRequest>) {
	const requestId = req.params.requestId;
	const { githubToken } = res.locals;

	if (!requestId) {
		req.log.warn("Missing requestId in query");
		throw new InvalidArgumentError("Missing requestId in query");
	}

	const { jiraHost, orgName, gitHubInstallationId } = await extractSubscriptionDeferredInstallPayload(requestId);
	if (!jiraHost) {
		throw new Error("No jiraHost");
	}

	if (!await hasAdminAccess(githubToken as string, jiraHost, gitHubInstallationId, req.log, undefined)) {
		req.log.warn(`Failed to add subscription to ${gitHubInstallationId}. User is not an admin of that installation`);
		throw new InsufficientPermissionError("User is not an admin for the organization");
	}

	res.status(200).send({ jiraHost, orgName });
});
