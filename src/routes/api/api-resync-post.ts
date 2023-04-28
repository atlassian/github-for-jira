import { Request, Response } from "express";
import { TaskType } from "~/src/sync/sync.types";
import { GitHubServerApp } from "models/github-server-app";
import { Subscription } from "models/subscription";
import { findOrStartSync } from "~/src/sync/sync-utils";
import { serializeSubscription } from "routes/api/api-utils";
import { Installation } from "models/installation";

const getIdsForExistingInstallations = async(installationIds, logger): Promise<number[]> => {
	const installations = installationIds.map(async(id: number): Promise<number | null> => {
		const installation: Installation | null = await Installation.getForId(id);

		if (installation?.id) {
			return installation?.id;
		} else {
			logger.warn({ installationId: id }, "No installation found");
			return null;
		}
	});
	const existingInstallations = await Promise.all(installations);
	return existingInstallations.filter(installation => installation !== null);
};

export const ApiResyncPost = async (req: Request, res: Response): Promise<void> => {
	// Partial by default, can be made full
	const syncType = req.body.syncType || "partial";
	// Defaults to anything not completed
	const statusTypes = req.body.statusTypes as string[];
	// Defaults to any installation
	const installationIds = req.body.installationIds as number[];
	// Can be limited to a certain amount if needed to not overload system
	const limit = Number(req.body.limit) || undefined;
	// Needed for 'pagination'
	const offset = Number(req.body.offset) || 0;
	// only resync installations whose "updatedAt" date is older than x seconds
	const inactiveForSeconds = Number(req.body.inactiveForSeconds) || undefined;
	// A date to start fetching commit history(main and branch) from.
	const commitsFromDate = req.body.commitsFromDate ? new Date(req.body.commitsFromDate) : undefined;
	// restrict sync to a subset of tasks
	const targetTasks = req.body.targetTasks as TaskType[];

	if (!statusTypes && !installationIds && !limit && !inactiveForSeconds) {
		res.status(400).send("Please provide at least one of the filter parameters!");
		return;
	}

	const existingInstallationIds = await getIdsForExistingInstallations(installationIds, req.log);

	if (!existingInstallationIds.length) {
		res.status(400).json("No installations exist for provided IDs");
		return;
	}

	if (commitsFromDate && commitsFromDate.valueOf() > Date.now()) {
		res.status(400).send("Invalid date value, cannot select a future date!");
		return;
	}

	const { uuid } = req.params;
	let gitHubServerApp;

	if (uuid) {
		gitHubServerApp = await GitHubServerApp.findForUuid(uuid);
		if (!gitHubServerApp) {
			res.status(400).json("No GitHub app found for provided uuid");
			return;
		}
	}

	const gitHubAppId = gitHubServerApp?.id;
	const subscriptions = await Subscription.getAllFiltered(gitHubAppId, installationIds, statusTypes, offset, limit, inactiveForSeconds);

	await Promise.all(subscriptions.map((subscription) =>
		findOrStartSync(subscription, req.log, syncType, commitsFromDate, targetTasks, { source: "api-resync" })
	));

	res.json(subscriptions.map(serializeSubscription));
};
