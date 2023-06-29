import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription, TaskStatus } from "~/src/models/subscription";

interface Page {
	pageNum: number;
	isCurrentPage: boolean;
}

export const JiraGetConnectedRepos = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {

	try {
		const { jiraHost, nonce } = res.locals;
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
							[Op.like]: `%${repoName}%`
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
							[Op.like]: `%${repoName}%`
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
				syncStatus: mapTaskStatus(getSyncStatus(repoSyncState)),
				branchStatus: repoSyncState?.branchStatus,
				commitStatus: repoSyncState?.commitStatus,
				pullStatus: repoSyncState?.pullStatus,
				buildStatus: repoSyncState?.buildStatus,
				deploymentStatus: repoSyncState?.deploymentStatus,
				failedCode: repoSyncState.failedCode
			};
		});

		res.render("jira-connected-repos.hbs", {
			host: jiraHost,
			repos: repos,
			subscriptionId,
			csrfToken: req.csrfToken(),
			nonce,
			...getPaginationState(page, pageSize, reposCount)
		});

	} catch (error) {
		return next(new Error(`Failed to render connected repos: ${error}`));
	}
};

const getPaginationState = (page: number, pageSize: number, reposCount: number) => {

	const totalPages = Math.ceil(reposCount / pageSize);
	const hasPrevPage = page > 1;
	const prevPageNum = page - 1;
	const hasNextPage = page < totalPages;
	const nextPageNum = page + 1;

	const pages = getPaginationNumbers(page, totalPages);

	return {
		page,
		totalPages,
		hasPrevPage,
		prevPageNum,
		hasNextPage,
		nextPageNum,
		pages
	};
};

const getPaginationNumbers = (currentPageNum: number, totalPages: number): Page[] => {

	const maxPagesToShow = 20;
	const pages: Page[] = [];

	// Determine the range of pages to show
	let startPage = Math.max(currentPageNum - Math.floor(maxPagesToShow / 2), 1);
	const endPage = Math.min(startPage + maxPagesToShow - 1, totalPages);

	// Adjust the range so it shows pages relative to current
	if (endPage - startPage < maxPagesToShow - 1) {
		startPage = Math.max(endPage - maxPagesToShow + 1, 1);
	}

	// Add the pages to the array
	for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
		pages.push({
			pageNum,
			isCurrentPage: pageNum === currentPageNum
		});
	}

	return pages;
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
