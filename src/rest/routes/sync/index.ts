import { Request, Response, NextFunction } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { errorWrapper } from "../../helper";
import { Subscription } from "models/subscription";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { determineSyncTypeAndTargetTasks } from "~/src/util/github-sync-helper";
import { BaseLocals } from "..";
import { InvalidArgumentError } from "~/src/config/errors";

interface RequestBody {
	installationId: number;
	appId: number;
	syncType: string;
	source: string;
	commitsFromDate: string;
}

const restSyncPost = async (
	req: Request<ParamsDictionary, unknown, RequestBody>,
	res: Response<unknown, BaseLocals>,
	next: NextFunction
) => {
	//TODO: We are yet to handle enterprise backfill
	// const cloudOrUUID = req.params.cloudOrUUID;
	// const gheUUID = cloudOrUUID === "cloud" ? undefined : "some-ghe-uuid";

	const {
		installationId: gitHubInstallationId,
		appId: gitHubAppId,
		syncType: syncTypeFromReq,
		source
	} = req.body;
	// A date to start fetching commit history(main and branch) from.
	const commitsFromDate = req.body.commitsFromDate
		? new Date(req.body.commitsFromDate)
		: undefined;

	const logAdditionalData = await booleanFlag(
		BooleanFlags.VERBOSE_LOGGING,
		res.locals.installation.jiraHost
	);

	logAdditionalData
		? req.log.info(
			{ gitHubInstallationId },
			"verbose logging - Received sync request on rest route")
		: req.log.info("Received sync request on rest route");

	try {
		const subscription = await Subscription.getSingleInstallation(
			res.locals.installation.jiraHost,
			gitHubInstallationId,
			gitHubAppId
		);
		if (!subscription) {
			req.log.info(
				{
					jiraHost: res.locals.installation.jiraHost,
					installationId: gitHubInstallationId
				},
				"Subscription not found when retrying sync."
			);
			throw new InvalidArgumentError("Subscription not found, cannot resync.");
		}

		if (commitsFromDate && commitsFromDate.valueOf() > Date.now()) {
			throw new InvalidArgumentError(
				"Invalid date value, cannot select a future date!"
			);
		}

		const { syncType, targetTasks } = determineSyncTypeAndTargetTasks(
			syncTypeFromReq,
			subscription
		);
		await findOrStartSync(
			subscription,
			req.log,
			syncType,
			commitsFromDate || subscription.backfillSince,
			targetTasks,
			{ source }
		);

		res.sendStatus(202);
	} catch (error: unknown) {
		next(new Error("Unauthorized"));
	}
};

export const SyncRouterHandler = errorWrapper("AnalyticsProxyHandler",restSyncPost);
