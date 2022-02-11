import { Request, Response, Router } from "express";
import { authenticateInstallCallback, authenticateUninstallCallback } from "../../../middleware/jira-jwt-middleware";
import postJiraInstall from "../../../jira/install";
import extractInstallationFromJiraCallback from "../../../jira/extract-installation-from-jira-callback";
import postJiraUninstall from "../../../jira/uninstall";

export const JiraEventsRouter = Router();

// TODO: remove enabled and disabled events once the descriptor is updated in marketplace
JiraEventsRouter.post("/disabled", (_: Request, res: Response) => {
	return res.sendStatus(204);
});
JiraEventsRouter.post("/enabled", (_: Request, res: Response) => {
	return res.sendStatus(204);
});

JiraEventsRouter.post("/installed", authenticateInstallCallback, postJiraInstall);
JiraEventsRouter.post("/uninstalled", authenticateUninstallCallback, extractInstallationFromJiraCallback, postJiraUninstall);
