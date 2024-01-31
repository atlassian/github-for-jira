import { NextFunction, Request, Response, Router } from "express";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { MaintenanceGet } from "./maintenance-get";

export const MaintenanceRouter = Router();
const ignoredPaths = [
	"/jira/atlassian-connect.json",
	"/jira/events/installed",
	"/jira/events/uninstalled"
];

const maintenanceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	if (!ignoredPaths.includes(req.path) && await booleanFlag(BooleanFlags.MAINTENANCE_MODE, res.locals.jiraHost)) {
		MaintenanceGet(req, res); return;
	}
	next();
};
MaintenanceRouter.use(maintenanceMiddleware);

MaintenanceRouter.get("/maintenance", MaintenanceGet);
