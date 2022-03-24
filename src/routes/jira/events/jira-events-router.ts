import { Request, Response, Router } from "express";
import postJiraInstall from "~/src/jira/install";
import extractInstallationFromJiraCallback from "~/src/jira/extract-installation-from-jira-callback";
import postJiraUninstall from "~/src/jira/uninstall";
import { verifyAsymmetricJwtTokenMiddleware } from "~/src/jira/util/jwt";

export const JiraEventsRouter = Router();

// TODO: remove enabled and disabled events once the descriptor is updated in marketplace
JiraEventsRouter.post("/disabled", (_: Request, res: Response) => {
	return res.sendStatus(204);
});
JiraEventsRouter.post("/enabled", (_: Request, res: Response) => {
	return res.sendStatus(204);
});

JiraEventsRouter.post("/installed", verifyAsymmetricJwtTokenMiddleware, postJiraInstall);
JiraEventsRouter.post("/uninstalled", verifyAsymmetricJwtTokenMiddleware, extractInstallationFromJiraCallback, postJiraUninstall);
