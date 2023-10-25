import { Octokit } from "@octokit/rest";
import Logger from "bunyan";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { transformWorkflow } from "../transforms/transform-workflow";
import { GitHubWorkflowPayload } from "~/src/interfaces/github";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { numberFlag, NumberFlags, shouldSendAll } from "config/feature-flags";
import { fetchNextPagesInParallel } from "~/src/sync/parallel-page-fetcher";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { PageSizeAwareCounterCursor } from "~/src/sync/page-counter-cursor";

type BuildWithCursor = { cursor: string } & Octokit.ActionsListRepoWorkflowRunsResponse;

// TODO: add types
const getTransformedBuilds = async (workflowRun, gitHubInstallationClient, alwaysSend: boolean, logger) => {
	const transformTasks = workflowRun.map(workflow => {
		const workflowItem = { workflow_run: workflow, workflow: { id: workflow.id } } as GitHubWorkflowPayload;
		return transformWorkflow(gitHubInstallationClient, workflowItem, alwaysSend, logger);
	});

	const transformedBuilds = await Promise.all(transformTasks);
	return transformedBuilds
		.filter(build => !!build)
		.map(build => build.builds)
		.flat();
};

export const getBuildTask = async (
	logger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | undefined,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {
	const smartCursor = new PageSizeAwareCounterCursor(cursor).scale(perPage);
	const numberOfPagesToFetchInParallel = await numberFlag(NumberFlags.NUMBER_OF_BUILD_PAGES_TO_FETCH_IN_PARALLEL, 0, jiraHost);
	if (!numberOfPagesToFetchInParallel || numberOfPagesToFetchInParallel <= 1) {
		return doGetBuildTask(logger, gitHubInstallationClient, repository, smartCursor, messagePayload);
	} else {
		return doGetBuildTaskInParallel(numberOfPagesToFetchInParallel, logger, gitHubInstallationClient, repository, smartCursor, messagePayload);
	}
};

const doGetBuildTaskInParallel = (
	numberOfPagesToFetchInParallel: number,
	logger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	repository: Repository,
	pageSizeAwareCursor: PageSizeAwareCounterCursor,
	messagePayload: BackfillMessagePayload
) => fetchNextPagesInParallel(
	numberOfPagesToFetchInParallel,
	pageSizeAwareCursor,
	(pageCursor) =>
		doGetBuildTask(
			logger,
			gitHubInstallationClient,
			repository,
			pageCursor,
			messagePayload
		)
);

const doGetBuildTask = async (
	parentLogger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	repository: Repository,
	pageSizeAwareCursor: PageSizeAwareCounterCursor,
	messagePayload: BackfillMessagePayload
) => {
	const logger = parentLogger.child({ backfillTask: "Build" });
	const startTime = Date.now();

	logger.info({ startTime }, "Backfill task started");
	const fromDate = messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const { data } = await gitHubInstallationClient.listWorkflowRuns(repository.owner.login, repository.name, pageSizeAwareCursor.perPage, pageSizeAwareCursor.pageNo);
	const { workflow_runs } = data;

	if (areAllBuildsEarlierThanFromDate(workflow_runs, fromDate)) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	const nextPageCursorStr = pageSizeAwareCursor.copyWithPageNo(pageSizeAwareCursor.pageNo + 1).serialise();

	const edgesWithCursor: BuildWithCursor[] = [{ total_count: data.total_count, workflow_runs, cursor: nextPageCursorStr }];

	if (!workflow_runs?.length) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	logger.info(`Found ${workflow_runs.length} workflow_runs`);
	logger.info(`First workflow_run.updated_at=${workflow_runs[0].updated_at}`);

	const alwaysSend = await shouldSendAll("builds-backfill", messagePayload.jiraHost, logger);
	const builds = await getTransformedBuilds(workflow_runs, gitHubInstallationClient, alwaysSend, logger);

	// When there are no valid builds return early with undefined JiraPayload so that no Jira calls are made
	if (!builds?.length) {
		logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: 0 }, "Backfill task complete");
		return {
			edges: edgesWithCursor,
			jiraPayload: undefined
		};
	}

	const jiraPayload = {
		... transformRepositoryDevInfoBulk(repository, gitHubInstallationClient.baseUrl),
		builds
	};

	logger.info({ processingTime: Date.now() - startTime, jiraPayloadLength: jiraPayload.builds?.length }, "Backfill task complete");
	return {
		edges: edgesWithCursor,
		jiraPayload
	};
};

const areAllBuildsEarlierThanFromDate = (builds: Octokit.ActionsListRepoWorkflowRunsResponseWorkflowRunsItem[], fromDate: Date | undefined): boolean => {

	if (!fromDate) return false;

	return builds.every(build => {
		const createdAt = new Date(build.created_at);
		return createdAt.getTime() < fromDate.getTime();
	});

};
