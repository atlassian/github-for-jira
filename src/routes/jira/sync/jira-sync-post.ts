import { Subscription } from "models/subscription";
import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { TaskType, SyncType } from "~/src/sync/sync.types";

export const JiraSyncPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { installationId: gitHubInstallationId, appId: gitHubAppId, syncType: syncTypeFromReq, source } = req.body;

	// A date to start fetching commit history(main and branch) from.
	const commitsFromDate = req.body.commitsFromDate ? new Date(req.body.commitsFromDate) : undefined;
	Sentry.setExtra("Body", req.body);

	req.log.info("Received sync request");

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

		const { syncType, targetTasks } = await determineSyncTypeAndTargetTasks(syncTypeFromReq, subscription);
		await findOrStartSync(subscription, req.log, syncType, commitsFromDate || subscription.backfillSince, targetTasks, { source });

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.ManualRestartBackfillTrackEventName,
			success: true,
			source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise,
			withStartingTime: commitsFromDate !== undefined,
			startTimeInDaysAgo: getStartTimeInDaysAgo(commitsFromDate)
		});

		res.sendStatus(202);
	} catch (error) {

		sendAnalytics(AnalyticsEventTypes.TrackEvent, {
			name: AnalyticsTrackEventsEnum.ManualRestartBackfillTrackEventName,
			success: false,
			source: !gitHubAppId ? AnalyticsTrackSource.Cloud : AnalyticsTrackSource.GitHubEnterprise,
			withStartingTime: commitsFromDate !== undefined,
			startTimeInDaysAgo: getStartTimeInDaysAgo(commitsFromDate)
		});

		next(new Error("Unauthorized"));
	}
};

const MILLISECONDS_IN_ONE_DAY = 24 * 60 * 60 * 1000;
const getStartTimeInDaysAgo = (commitsFromDate: Date | undefined) => {
	if (commitsFromDate === undefined) return undefined;
	return Math.floor((Date.now() -  commitsFromDate?.getTime()) / MILLISECONDS_IN_ONE_DAY);
};

type SyncTypeAndTargetTasks = {
	syncType: SyncType,
	targetTasks: TaskType[] | undefined,
};

const determineSyncTypeAndTargetTasks = async (syncTypeFromReq: string, subscription: Subscription): Promise<SyncTypeAndTargetTasks> => {

	if (syncTypeFromReq === "full") {
		return { syncType: "full", targetTasks: undefined };
	}

	if (subscription.syncStatus === "FAILED") {
		return { syncType: "full", targetTasks: undefined };
	}

	return { syncType: "partial", targetTasks: ["pull", "branch", "commit", "build", "deployment"] };
};
