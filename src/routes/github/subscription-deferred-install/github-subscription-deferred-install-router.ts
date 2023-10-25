import { NextFunction, Request, Response, Router } from "express";
import { extractSubscriptionDeferredInstallPayload, SubscriptionDeferredInstallPayload } from "services/subscription-deferred-install-service";
import { Installation } from "models/installation";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { GithubAuthMiddleware } from "routes/github/github-oauth";
import {
	GitHubSubscriptionDeferredInstallGet
} from "routes/github/subscription-deferred-install/github-subscription-deferred-install-get";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import {
	GithubSubscriptionDeferredInstallPost
} from "routes/github/subscription-deferred-install/github-subscription-deferred-install-post";
import { csrfMiddleware } from "middleware/csrf-middleware";

const GithubSubscriptionDeferredInstallRouter = Router({ mergeParams: true });

const subRouter = Router({ mergeParams: true });

const INVALID_PAYLOAD_ERR = "Invalid payload";

GithubSubscriptionDeferredInstallRouter.use("/request/:requestId", subRouter);

const validatePayloadAndPopulateJiraHost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	let parsedPayload: SubscriptionDeferredInstallPayload | undefined;
	try {
		parsedPayload = await extractSubscriptionDeferredInstallPayload(req.params["requestId"]);
	} catch (err: unknown) {
		req.log.warn({ err }, "Cannot deserialize");
		res.status(400).json({ error: INVALID_PAYLOAD_ERR });
		return;
	}

	const installation = await Installation.findByPk(parsedPayload.installationIdPk);
	if (!installation) {
		req.log.warn("No installation");
		res.status(400).json({ error: INVALID_PAYLOAD_ERR });
		return;
	}

	if (!await booleanFlag(BooleanFlags.ENABLE_SUBSCRIPTION_DEFERRED_INSTALL, installation.jiraHost)) {
		res.status(401).json({ error: "Feature is disabled" });
		return;
	}

	res.locals.jiraHost = installation.jiraHost;
	res.locals.installation = installation;
	// DO NOT PUT jiraHost to session! This router is invoked by jira non-admins, that would give them admin perms!

	return next();
};

const validateGitHubConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const parsedPayload = await extractSubscriptionDeferredInstallPayload(req.params["requestId"]);

	if (parsedPayload.gitHubServerAppIdPk != res.locals.gitHubAppConfig.gitHubAppId) {
		req.log.warn("Wrong appIdPk");
		res.status(400).json({ error: INVALID_PAYLOAD_ERR });
		return;
	}

	return next();
};

subRouter.use(validatePayloadAndPopulateJiraHost);
subRouter.use(GithubServerAppMiddleware);
subRouter.use(validateGitHubConfig);
subRouter.use(GithubAuthMiddleware);
subRouter.use(csrfMiddleware);

subRouter.get("/", GitHubSubscriptionDeferredInstallGet);
subRouter.post("/", GithubSubscriptionDeferredInstallPost);

export default GithubSubscriptionDeferredInstallRouter;


