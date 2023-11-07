import { JiraClient } from "models/jira-client";
import { Subscription } from "models/subscription";
import { Installation } from "models/installation";
import Logger from "bunyan";
import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { getLogger } from "config/logger";

// TODO: add tests
type SerializedSubscription = Pick<Subscription, "gitHubInstallationId" | "jiraHost" | "createdAt" | "updatedAt" | "syncStatus">;
export const serializeSubscription = (subscription: Subscription): SerializedSubscription => ({
	gitHubInstallationId: subscription.gitHubInstallationId,
	jiraHost: subscription.jiraHost,
	createdAt: subscription.createdAt,
	updatedAt: subscription.updatedAt,
	syncStatus: subscription.syncStatus
});

interface SerializedInstallation extends Pick<Installation, "clientKey"> {
	host: string;
	authorized: boolean;
	enabled: boolean;
	gitHubInstallations: SerializedSubscription[];
}

export const serializeJiraInstallation = async (jiraInstallation: Installation, log: Logger): Promise<SerializedInstallation> => {
	const jiraClient = await JiraClient.getNewClient(jiraInstallation, log);

	return {
		clientKey: jiraInstallation.clientKey,
		host: jiraInstallation.jiraHost,
		enabled: true,
		authorized: (await jiraClient.isAuthorized()),
		gitHubInstallations: (await jiraInstallation.subscriptions()).map((subscription) => serializeSubscription(subscription))
	};
};

/**
 * Finds the validation errors in this request and wraps them in an object with handy functions
 */
export const returnOnValidationError = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(422).json({ errors: errors.array() });
		(req.log || getLogger("requestValidator")).warn({ errors: errors.array(), paramUuid: req.params?.uuid }, "Fail on validator request, skip with 422");
		return;
	}
	next();
};
