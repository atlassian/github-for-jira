import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { errorWrapper } from "../../helper";
import { Subscription } from "models/subscription";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { determineSyncTypeAndTargetTasks } from "~/src/util/github-sync-helper";
import { BaseLocals } from "..";
import { RestApiError } from "~/src/config/errors";
import { RestSyncReqBody } from "~/src/rest-interfaces";


const restSyncPost = async (
	req: Request<ParamsDictionary, unknown, RestSyncReqBody>,
	res: Response<unknown, BaseLocals>
) => {
	//TODO: We are yet to handle enterprise backfill
	const cloudOrUUID = req.params.cloudOrUUID;
	const gheUUID = cloudOrUUID === "cloud" ? undefined : req.params.cloudOrUUID;
	let gitHubAppId : number | undefined = undefined;
	if (gheUUID) {
		gitHubAppId = parseFloat(gheUUID);
	}

	const {
		installationId: gitHubInstallationId,
		syncType: syncTypeFromReq,
		source
	} = req.body;
	// A date to start fetching commit history(main and branch) from.
	const commitsFromDate = req.body.commitsFromDate
		? new Date(req.body.commitsFromDate)
		: undefined;

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
			throw new RestApiError(400, "INVALID_OR_MISSING_ARG", "Subscription not found, cannot resync.");
		}

		if (commitsFromDate && commitsFromDate.valueOf() > Date.now()) {
			throw new RestApiError(400, "INVALID_OR_MISSING_ARG", "Invalid date value, cannot select a future date");
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
		throw new RestApiError(500, "UNKNOWN", "Something went wrong");
	}
};

export const SyncRouterHandler = errorWrapper("AnalyticsProxyHandler",restSyncPost);
