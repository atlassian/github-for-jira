import { Request, Response, Router } from "express";
import { JiraEventsInstallPost } from "routes/jira/events/jira-events-install-post";
import { extractInstallationFromJiraCallback } from "~/src/jira/extract-installation-from-jira-callback";
import { JiraEventsUninstallPost } from "routes/jira/events/jira-events-uninstall-post";
import { verifyAsymmetricJwtTokenMiddleware } from "~/src/jira/util/jwt";

export const JiraEventsRouter = Router();

// TODO: remove enabled and disabled events once the descriptor is updated in marketplace
JiraEventsRouter.post("/disabled", (_: Request, res: Response) => {
	return res.sendStatus(204);
});
JiraEventsRouter.post("/enabled", (_: Request, res: Response) => {
	return res.sendStatus(204);
});

JiraEventsRouter.post("/installed", verifyAsymmetricJwtTokenMiddleware, JiraEventsInstallPost);
JiraEventsRouter.post("/uninstalled", verifyAsymmetricJwtTokenMiddleware, extractInstallationFromJiraCallback, JiraEventsUninstallPost);
