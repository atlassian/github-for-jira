import { Request, Response, Router } from "express";
import { JiraEventsInstallPost } from "routes/jira/events/jira-events-install-post";
import { extractInstallationFromJiraCallback } from "~/src/jira/extract-installation-from-jira-callback";
import { JiraEventsUninstallPost } from "routes/jira/events/jira-events-uninstall-post";
import { validateAsymmetricJwtTokenMiddleware } from "~/src/jira/util/jwt";
import { getConfiguredAppProperties, saveConfiguredAppProperties } from "utils/app-properties-utils";

export const JiraEventsRouter = Router();

// TODO: remove enabled and disabled events once the descriptor is updated in marketplace

const JiraDisabledPost = (_: Request, res: Response) => {
	return res.sendStatus(204);
};

JiraEventsRouter.post("/disabled", JiraDisabledPost);

const JiraEnabledPost = async (req: Request, res: Response) => {
	const { baseUrl } = req.body;

	try {
		const appProperties = await getConfiguredAppProperties(baseUrl, req.log);
		if (!appProperties || appProperties.status !== 200) {
			await saveConfiguredAppProperties(baseUrl, req.log, false);
			req.log.info("App property set to false after installation for ", baseUrl);
		}
	} catch (err: unknown) {
		req.log.error({ err }, "Failed to set app property after installation");
	}

	return res.sendStatus(204);
};

JiraEventsRouter.post("/enabled", JiraEnabledPost);

JiraEventsRouter.post("/installed", validateAsymmetricJwtTokenMiddleware, JiraEventsInstallPost);
JiraEventsRouter.post("/uninstalled", validateAsymmetricJwtTokenMiddleware, extractInstallationFromJiraCallback, JiraEventsUninstallPost);
