import { Router, Request, Response } from "express";
import { errorWrapper } from "../../helper";
import { GetDeferredInstallationUrl } from "rest-interfaces";
import { BaseLocals } from "..";
import {
	registerSubscriptionDeferredInstallPayloadRequest,
	SubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { envVars } from "config/env";
import { InvalidArgumentError } from "config/errors";

export const DeferredInstallationUrlRoute = Router({ mergeParams: true });

DeferredInstallationUrlRoute.get("/", errorWrapper("GetDeferredInstallationUrl", async function DeferredInstallationUrlRoute(req: Request, res: Response<GetDeferredInstallationUrl, BaseLocals>) {
	const { gitHubInstallationId, gitHubOrgName } = req.query;
	const { installation } = res.locals;

	if (!gitHubInstallationId) {
		req.log.warn("Missing gitHubInstallationId in query");
		throw new InvalidArgumentError("Missing gitHubInstallationId in query");
	}

	if (!gitHubOrgName) {
		req.log.warn("Missing gitHubOrgName in query");
		throw new InvalidArgumentError("Missing gitHubOrgName in query");
	}

	const payload: SubscriptionDeferredInstallPayload = {
		installationIdPk: installation.id,
		jiraHost: installation.jiraHost,
		gitHubInstallationId: parseInt(gitHubInstallationId.toString()),
		orgName: gitHubOrgName.toString(),
		gitHubServerAppIdPk: undefined // TODO: This only works for cloud, Add this value for GHE servers
	};
	const requestId = await registerSubscriptionDeferredInstallPayloadRequest(payload);

	// TODO: This only works for cloud, Add this value for GHE servers
	const	deferredInstallUrl = `${envVars.APP_URL}/spa/deferred?requestId=${requestId}`;
	res.status(200).json({
		deferredInstallUrl
	});
}));
