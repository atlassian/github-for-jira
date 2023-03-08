import { Subscription } from "models/subscription";
import * as Sentry from "@sentry/node";
import { NextFunction, Request, Response } from "express";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsTrackEventsEnum, AnalyticsTrackSource } from "interfaces/common";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";

export const JiraSyncPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { installationId: gitHubInstallationId, appId: gitHubAppId } = req.body;

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

		const shouldUseBackfillAlgoIncremental = await booleanFlag(BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL, res.locals.installation.jiraHost);
		if (shouldUseBackfillAlgoIncremental && isDataAlreadyBackfilled(commitsFromDate, subscription.backfillSince)) {
			req.log.info({ commitsFromDate, backfillSince: subscription.backfillSince }, "Data already backfilled, skipping... ");
			res.sendStatus(202);
			return;
		}	else if (shouldUseBackfillAlgoIncremental && isIncrementalBackfilling(commitsFromDate, subscription.backfillSince)) {
			await findOrStartSync(subscription, req.log, false, "partial", commitsFromDate, subscription.backfillSince, ["pull", "branch", "commit", "build", "deployment"]);
		} else {
			await findOrStartSync(subscription, req.log, false, "full", commitsFromDate);
		}

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

const isDataAlreadyBackfilled = (startDate: Date | undefined, endDate: Date | undefined) => {
	// case: all data already backfilled and user requested to backfill data for specific date range.
	if (startDate && !endDate) {
		return true;
	}
	if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
		return true;
	}
	return false;
};

const isIncrementalBackfilling = (startDate: Date | undefined, endDate: Date | undefined): boolean => {
	if (!endDate || !startDate) {
		return false;
	}
	return startDate.getTime() <= endDate.getTime();
};
