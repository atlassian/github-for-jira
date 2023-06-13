import { Request, Response } from "express";
import { extractParsedPayload } from "utils/subscription-deferred-install-payload";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";

export const GithubSubscriptionDeferredInstallPost = async (req: Request, res: Response) => {
	const payload = await extractParsedPayload(req);
	const { githubToken, installation } = res.locals;

	const result = await verifyAdminPermsAndFinishInstallation(
		githubToken, installation, payload.gitHubServerAppIdPk, payload.gitHubInstallationId, req.log
	);
	if (result.error) {
		res.status(401).json(result);
		return;
	}

	res.status(200).json({ ok: true });
};
