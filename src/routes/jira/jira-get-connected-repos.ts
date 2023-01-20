import { NextFunction, Request, Response } from "express";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription, TaskStatus } from "~/src/models/subscription";

export const JiraGetConnectedRepos = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {

	try {
		const { jiraHost, nonce } = res.locals;
		const subscriptionId = Number(req.params.subscriptionId) || Number(req.body.subscriptionId);

		if (!jiraHost) {
			req.log.warn({ jiraHost, req, res }, "Missing jiraHost");
			res.status(404).send(`Missing Jira Host`);
			return;
		}

		if (!subscriptionId) {
			req.log.error("Missing Subscription ID");
			res.status(401).send("Missing Subscription ID");
			return;
		}

		const subscription = await Subscription.findByPk(subscriptionId);

		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription);
		const repos = repoSyncStates.map((repoSyncState) => {
			return {
				name: repoSyncState.repoFullName,
				syncStatus: mapTaskStatus(getSyncStatus(repoSyncState))
			};
		});

		res.render("jira-connected-repos.hbs", {
			host: jiraHost,
			repos,
			csrfToken: req.csrfToken(),
			nonce
		});

	} catch (error) {
		return next(new Error(`Failed to render connected repos: ${error}`));
	}
};

const getSyncStatus = (repoSyncState: RepoSyncState): TaskStatus => {

	const statuses = [repoSyncState?.branchStatus, repoSyncState?.commitStatus, repoSyncState?.pullStatus, repoSyncState?.buildStatus, repoSyncState?.deploymentStatus];
	if (statuses.includes("pending")) {
		return "pending";
	}
	if (statuses.includes("failed")) {
		return "failed";
	}
	const completeStatusesCount = statuses.filter((status) => status == "complete").length;
	if (completeStatusesCount === statuses.length) {
		return "complete";
	}
	return "pending";
};

const mapTaskStatus = (syncStatus: TaskStatus): string => {
	switch (syncStatus) {
		case "pending":
			return "IN PROGRESS";
		case "complete":
			return "FINISHED";
		case "failed":
			return "FAILED";
		default:
			return syncStatus;
	}
};