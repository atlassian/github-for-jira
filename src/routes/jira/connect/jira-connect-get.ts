import { NextFunction, Request, Response } from "express";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";

export const JiraConnectGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira Connect page request");

		sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.SelectGitHubProductEventName,
			jiraHost: res.locals.jiraHost
		});

		res.render("jira-select-github-product.hbs");

		req.log.info("Jira Connect page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira Connect page: ${error}`));
	}
};