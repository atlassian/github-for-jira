import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription, TaskStatus } from "~/src/models/subscription";

export const JiraGetSyncededRepos = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {

	try {
		const subscriptionId = Number(req.params.subscriptionId);
		const page = Number(req.query.page || 1);
		const pageSize = Number(req.query.pageSize || 10);
		const repoName = req.query.repoName || "";
		const syncStatusFilter = req.query.syncStatus || undefined;

		if (!subscriptionId) {
			req.log.error("Missing Subscription ID");
			res.status(401).send("Missing Subscription ID");
			return;
		}

		const subscription = await Subscription.findByPk(subscriptionId);

		if (!subscription) {
			req.log.error("Missing Subscription");
			res.status(401).send("Missing Subscription");
			return;
		}

		let syncStatusCondition = {};
		if (syncStatusFilter && syncStatusFilter !== "all") {
			syncStatusCondition = {
				[Op.or]: [
					{ branchStatus: `${syncStatusFilter}` },
					{ commitStatus: `${syncStatusFilter}` },
					{ pullStatus: `${syncStatusFilter}` },
					{ buildStatus: `${syncStatusFilter}` },
					{ deploymentStatus: `${syncStatusFilter}` }
				]
			};
		}

		const reposCount = await RepoSyncState.countSubscriptionRepos(subscription, {
			where: {
				[Op.and]: [
					{
						repoName: {
							[Op.iLike]: `%${repoName}%`
						}
					},
					{
						...syncStatusCondition
					}
				]

			}
		});

		const offset = page == 1 ? 0 : (page - 1) * pageSize;

		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, {
			where: {
				[Op.and]: [
					{
						repoName: {
							[Op.iLike]: `%${repoName}%`
						}
					},
					{
						...syncStatusCondition
					}
				]

			},
			limit: pageSize,
			offset
		});
		const repos = repoSyncStates.map((repoSyncState) => {
			return {
				name: repoSyncState.repoFullName,
				syncStatus: getSyncStatus(repoSyncState),
				branchStatus: repoSyncState?.branchStatus,
				commitStatus: repoSyncState?.commitStatus,
				pullStatus: repoSyncState?.pullStatus,
				buildStatus: repoSyncState?.buildStatus,
				deploymentStatus: repoSyncState?.deploymentStatus,
				failedCode: repoSyncState.failedCode
			};
		});
		const completedRepos = repos.filter(repo => ['complete','failed'].includes(repo.syncStatus)).length;

		res.status(200).send({
			completedRepos,
			subscriptionId,
			reposCount,
			syncCompleted: completedRepos === reposCount,
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

