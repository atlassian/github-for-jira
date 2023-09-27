import { NextFunction, Request, Response } from "express";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import { errorStringFromUnknown } from "~/src/util/error-string-from-unknown";

export const JiraConnectGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		req.log.info("Received Jira Connect page request");

		await sendAnalytics(res.locals.jiraHost, AnalyticsEventTypes.ScreenEvent, {
			name: AnalyticsScreenEventsEnum.SelectGitHubProductEventName
		}, {
			jiraHost: res.locals.jiraHost
		});

		res.render("jira-select-github-product.hbs");

		req.log.info("Jira Connect page rendered successfully.");
	} catch (error: unknown) {
		return next(new Error(`Failed to render Jira Connect page: ${errorStringFromUnknown(error)}`));
	}
};
