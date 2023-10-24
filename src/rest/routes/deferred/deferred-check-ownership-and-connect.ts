import { Request, Response } from "express";
import { errorWrapper } from "../../helper";
import { extractSubscriptionDeferredInstallPayload } from "services/subscription-deferred-install-service";
import { InsufficientPermissionError, InvalidArgumentError } from "config/errors";
import { OrgOwnershipResponse } from "rest-interfaces";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";
import { Installation } from "models/installation";

export const DeferredCheckOwnershipAndConnectRoute = errorWrapper("CheckOwnershipAndConnectRoute", async function DeferredCheckOwnershipAndConnectRoute(req: Request, res: Response<OrgOwnershipResponse>) {
	const { githubToken } = res.locals;
	const requestId = req.params.requestId;

	if (!requestId) {
		req.log.warn("Missing requestId in query");
		throw new InvalidArgumentError("Missing requestId in query");
	}

	const { gitHubInstallationId, jiraHost, installationIdPk } = await extractSubscriptionDeferredInstallPayload(requestId);
	if (!jiraHost) {
		req.log.warn("Missing jiraHost from the requestId");
		throw new InvalidArgumentError("Missing jiraHost from the requestId");
	}
	const installation = await Installation.findByPk(installationIdPk);
	if (!installation) {
		req.log.warn("Installation not found for this requestId");
		throw new InvalidArgumentError("Installation not found for this requestId");
	}
	const isAdminResponse = await verifyAdminPermsAndFinishInstallation(
		githubToken as string,
		installation,
		undefined,// TODO: Need to pass this value later for GHE apps
		gitHubInstallationId,
		true,
		req.log
	);
	if (isAdminResponse.errorCode === "NOT_ADMIN") {
		req.log.warn("User is not an admin of the org");
		throw new InsufficientPermissionError(isAdminResponse.error || "Not admin of org");
	} else {
		res.sendStatus(200);
	}
});

