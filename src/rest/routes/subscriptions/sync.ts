import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { errorWrapper } from "../../helper";
import { Subscription } from "models/subscription";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { determineSyncTypeAndTargetTasks } from "~/src/util/github-sync-helper";
import { BaseLocals } from "..";
import { InsufficientPermissionError, RestApiError } from "~/src/config/errors";
import { RestSyncReqBody } from "~/src/rest-interfaces";
// import { GitHubServerApp } from "~/src/models/github-server-app";

const restSyncPost = async (
	req: Request<ParamsDictionary, unknown, RestSyncReqBody>,
	res: Response<string, BaseLocals>
) => {
	const {
		syncType: syncTypeFromReq,
		source,
		commitsFromDate: commitsFrmDate
	} = req.body;

	// A date to start fetching commit history(main and branch) from.
	const commitsFromDate = commitsFrmDate ? new Date(commitsFrmDate) : undefined;
	if (commitsFromDate && commitsFromDate.valueOf() > Date.now()) {
		throw new RestApiError(
			400,
			"INVALID_OR_MISSING_ARG",
			"Invalid date value, cannot select a future date"
		);
	}

	const subscriptionId: number = Number(req.params.subscriptionId);
	if (!subscriptionId) {
		req.log.info(
			{
				jiraHost: res.locals.installation.jiraHost,
				subscriptionId
			},
			"Subscription ID not found when retrying sync."
		);
		throw new RestApiError(
			400,
			"INVALID_OR_MISSING_ARG",
			"Subscription ID not found when retrying sync."
		);
	}

	//TODO: We are yet to handle enterprise backfill
	// const gitHubAppId: number | undefined = undefined;
	// const cloudOrUUID = req.params.cloudOrUUID;
	// const gheUUID = cloudOrUUID === "cloud" ? undefined : req.params.cloudOrUUID;
	// if (gheUUID) {
	// 	const ghEnterpriseServers: GitHubServerApp[] = await GitHubServerApp.findForInstallationId(gitHubInstallationId) || [];
	// 	gitHubAppId = ghEnterpriseServers[0]?.appId;
	// }

	const subscription = await Subscription.findByPk(subscriptionId);

	if (!subscription) {
		req.log.info(
			{
				jiraHost: res.locals.installation.jiraHost,
				subscriptionId
			},
			"Subscription not found when retrying sync."
		);
		throw new RestApiError(
			400,
			"INVALID_OR_MISSING_ARG",
			"Subscription not found, cannot resync."
		);
	}

	const localJiraHost = res.locals.installation.jiraHost;

	if (subscription.jiraHost !== localJiraHost) {
		throw new InsufficientPermissionError("Forbidden - mismatched Jira Host");
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
};

export const SyncRouterHandler = errorWrapper(
	"SyncRouterHandler",
	restSyncPost
);
