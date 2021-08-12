import { Request, Response } from "express";

export default (req: Request, res: Response) => {
	// if getting showing page in Atlassian Marketplace, need to return 200
	// for the interceptor not to prevent the maintenance mode from showing.
	if (req.path === "/jira/configuration" && req.query.xdm_e && req.query.jwt) {
		res.status(200);
	} else {
		// Best HTTP status code for maintenance mode: https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#5xx_server_errors
		res.status(503);
	}
	return res.render("maintenance.hbs", {
		title: "Github for Jira - Under Maintenance",
		APP_URL: process.env.APP_URL
	});
};
