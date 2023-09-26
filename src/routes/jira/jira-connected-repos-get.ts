import { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { RepoSyncState } from "~/src/models/reposyncstate";
import { Subscription, TaskStatus } from "~/src/models/subscription";
import { sequelize } from "models/sequelize";
import { errorStringFromUnknown } from "~/src/util/error-string-from-unknown";

interface Page {
	pageNum: number;
	isCurrentPage: boolean;
}

const mapFilterSyncStatusToQueryCondition = (filterStatusField: string | undefined) => {
	if (!filterStatusField || filterStatusField === "all") {
		return {};
	}
	if (filterStatusField === "pending") {
		return {
			[Op.or]: [
				{ branchStatus: "pending" },
				{ branchStatus: null },
				{ commitStatus: "pending" },
				{ commitStatus: null },
				{ pullStatus: "pending" },
				{ pullStatus: null },
				{ buildStatus: "pending" },
				{ buildStatus: null },
				{ deploymentStatus: "pending" },
				{ deploymentStatus: null }
			]
		};
	} else if (filterStatusField == "failed") {
		return {
			[Op.or]: [
				{ branchStatus: "failed" },
				{ commitStatus: "failed" },
				{ pullStatus: "failed" },
				{ buildStatus: "failed" },
				{ deploymentStatus: "failed" }
			]
		};
	}
	return undefined;
};

export const JiraConnectedReposGet = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {

	try {
		const { jiraHost, nonce } = res.locals;
		const subscriptionId = Number(req.params.subscriptionId);
		const pageNumber = Number(req.query.pageNumber) || 1;
		const pageSize = Number(req.query.pageSize) || 10;
		const filterRepoName = (req.query.repoName || "") as string;
		const filterSyncStatus = (req.query.syncStatus || undefined) as (string | undefined);

		if (!subscriptionId) {
			req.log.error("Missing Subscription ID");
			res.status(400).send("Missing Subscription ID");
			return;
		}

		if (pageSize > 100) {
			req.log.error("pageSize cannot be larger than 100");
			res.status(400).send("pageSize cannot be larger than 100");
			return;
		}

		const subscription = await Subscription.findByPk(subscriptionId);

		if (!subscription || subscription.jiraHost !== jiraHost) {
			req.log.error("Missing Subscription");
			res.status(400).send("Missing Subscription");
			return;
		}

		const syncStatusCondition = mapFilterSyncStatusToQueryCondition(filterSyncStatus);
		if (syncStatusCondition === undefined) {
			req.log.error({ filterStatusField: filterSyncStatus }, "invalid status field");
			res.status(400).send("invalid status field");
			return;
		}

		const repoFilterCondition = {
			repoFullName: {
				[Op.like]: sequelize.literal(sequelize.escape(`%${filterRepoName}%`))
			}
		};

		const filterCondition = {
			[Op.and]: [
				repoFilterCondition,
				syncStatusCondition
			]
		};

		const reposCount = await RepoSyncState.countSubscriptionRepos(subscription, {
			where: filterCondition
		});

		const offset = pageNumber == 1 ? 0 : (pageNumber - 1) * pageSize;

		const repoSyncStates = await RepoSyncState.findAllFromSubscription(subscription, pageSize, offset, [["repoFullName", "ASC"]], {
			where: filterCondition
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
			...getPaginationState(pageNumber, pageSize, reposCount)
		});

	} catch (err: unknown) {
		req.log.warn({ err }, "Failed to render connected repos");
		return next(new Error(`Failed to render connected repos: ${errorStringFromUnknown(err)}`));
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
			return "IN PROGRESS";
	}
};
