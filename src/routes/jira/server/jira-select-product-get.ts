import { NextFunction, Request, Response } from "express";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";

export const JiraSelectProductGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira select GitHub product page request");

		sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.SelectGitHubProductEventName,
			jiraHost: res.locals.jiraHost
		});

		res.render("jira-select-github-product.hbs", {
			previousPagePath: "github-post-install-page"
		});

		req.log.info("Jira select GitHub product page rendered successfully.");
	} catch (error) {
		return next(new Error(`Failed to render Jira select GitHub product page: ${error}`));
	}
};
