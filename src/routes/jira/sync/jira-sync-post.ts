import { Subscription } from "models/subscription";
import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { determineSyncTypeAndTargetTasks, getStartTimeInDaysAgo } from "../../../util/github-sync-helper";

export const JiraSyncPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { installationId: gitHubInstallationId, appId: gitHubAppId, syncType: syncTypeFromReq, source } = req.body;

	// A date to start fetching commit history(main and branch) from.
	const commitsFromDate = req.body.commitsFromDate ? new Date(req.body.commitsFromDate) : undefined;
	Sentry.setExtra("Body", req.body);

	const logAdditionalData = await booleanFlag(BooleanFlags.VERBOSE_LOGGING, res.locals.installation.jiraHost);

	logAdditionalData ? req.log.info({ gitHubInstallationId }, "verbose logging - Received sync request")
		: req.log.info("Received sync request");

	try {
		const subscription = await Subscription.getSingleInstallation(res.locals.installation.jiraHost, gitHubInstallationId, gitHubAppId);
		if (!subscription) {
			req.log.info({
				jiraHost: res.locals.installation.jiraHost,
				installationId: gitHubInstallationId
			}, "Subscription not found when retrying sync.");
			res.status(404).send("Subscription not found, cannot resync.");
			return;
		}

		if (commitsFromDate && commitsFromDate.valueOf() > Date.now()){
			res.status(400).send("Invalid date value, cannot select a future date!");
			return;
		}

		const { syncType, targetTasks } = determineSyncTypeAndTargetTasks(syncTypeFromReq, subscription);
		await findOrStartSync(subscription, req.log, syncType, commitsFromDate || subscription.backfillSince, targetTasks, { source });

		await sendAnalytics(res.locals.jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.ManualRestartBackfillTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.ManualRestartBackfillTrackEventName,
			source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise
		}, {
			success: true,
			withStartingTime: commitsFromDate !== undefined,
			startTimeInDaysAgo: getStartTimeInDaysAgo(commitsFromDate)
		});

		res.sendStatus(202);
	} catch (error: unknown) {

		await sendAnalytics(res.locals.jiraHost, AnalyticsEventTypes.TrackEvent, {
			action: AnalyticsTrackEventsEnum.ManualRestartBackfillTrackEventName,
			actionSubject: AnalyticsTrackEventsEnum.ManualRestartBackfillTrackEventName,
			source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise
		}, {
			success: false,
			withStartingTime: commitsFromDate !== undefined,
			startTimeInDaysAgo: getStartTimeInDaysAgo(commitsFromDate)
		});

		next(new Error("Unauthorized"));
	}
};
