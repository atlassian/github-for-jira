// setup route middlewares
import { NextFunction, Request, Response } from "express";
import { postInstallUrl } from "routes/jira/jira-atlassian-connect-get";

export const jirahostMiddleware = (req: Request, res: Response, next: NextFunction) => {
	if (req.cookies.jiraHost) {
		// Save jirahost to secure session
		req.session.jiraHost = req.cookies.jiraHost;
		// delete jirahost from cookies.
		res.clearCookie("jiraHost");
	}

	if (req.path == postInstallUrl && req.method == "GET") {
		// Only save xdm_e query when on the GET post install url (iframe url)
		res.locals.jiraHost = req.query.xdm_e as string;
	} else if ((req.path == postInstallUrl && req.method != "GET") || req.path == "/jira/sync") {
		// Only save the jiraHost from the body for specific routes that use it
		res.locals.jiraHost = req.body?.jiraHost;
	} else {
		// Save jiraHost from session for any other URLs
		res.locals.jiraHost = req.session.jiraHost;
	}

	req.addLogFields({ jiraHost: res.locals.jiraHost });

	next();
};
