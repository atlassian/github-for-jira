import { Octokit } from "@octokit/rest";
import Logger from "bunyan";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { transformWorkflow } from "../transforms/transform-workflow";
import { GitHubWorkflowPayload } from "~/src/interfaces/github";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
import { numberFlag, NumberFlags, booleanFlag, BooleanFlags } from "config/feature-flags";
import { fetchNextPagesInParallel } from "~/src/sync/parallel-page-fetcher";
import { BackfillMessagePayload } from "../sqs/sqs.types";
import { PageSizeAwareCounterCursor, scaleCursor } from "~/src/sync/sync-utils";

type BuildWithCursor = { cursor: string } & Octokit.ActionsListRepoWorkflowRunsResponse;

// TODO: add types
const getTransformedBuilds = async (workflowRun, gitHubInstallationClient, logger) => {

	const transformTasks = workflowRun.map(workflow => {
		const workflowItem = { workflow_run: workflow, workflow: { id: workflow.id } } as GitHubWorkflowPayload;
		return transformWorkflow(gitHubInstallationClient, workflowItem, logger);
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
	cursor: string | number = 1,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {
	const pageSizeCoef = await numberFlag(NumberFlags.ACCELERATE_BACKFILL_COEF, 0, jiraHost);
	if (!pageSizeCoef) {
		return doGetBuildTask(logger, gitHubInstallationClient, jiraHost, repository, cursor, perPage, messagePayload);
	} else {
		const shouldFetchNextPageInParallel = pageSizeCoef > 5;

		const data = await fetchNextPagesInParallel(
			shouldFetchNextPageInParallel ? 10 : 1,
			Number(cursor),
			(scaledPageNoToFetch) =>
				doGetBuildTask(
					logger, gitHubInstallationClient, jiraHost, repository,
					scaledPageNoToFetch,
					perPage,
					messagePayload
				)
		);

		return data;
	}
};

const doGetBuildTask = async (
	logger: Logger,
	gitHubInstallationClient: GitHubInstallationClient,
	jiraHost: string,
	repository: Repository,
	cursor: string | number = 1,
	perPage: number,
	messagePayload: BackfillMessagePayload
) => {
	logger.info("Syncing Builds: started");
	let pageSizeAwareCursor: PageSizeAwareCounterCursor;
	if (Number(cursor)) {
		pageSizeAwareCursor = {
			perPage: perPage,
			pageNo: Number(cursor)
		};
	} else {
		pageSizeAwareCursor = scaleCursor(JSON.parse("" + cursor) as PageSizeAwareCounterCursor, perPage);
	}

	const useIncrementalBackfill = await booleanFlag(BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL, jiraHost);
	const fromDate = useIncrementalBackfill && messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const { data } = await gitHubInstallationClient.listWorkflowRuns(repository.owner.login, repository.name, pageSizeAwareCursor.perPage, pageSizeAwareCursor.pageNo, fromDate);
	const { workflow_runs } = data;
	const nextPageCursor = JSON.stringify({
		perPage: pageSizeAwareCursor.perPage,
		pageNo: pageSizeAwareCursor.pageNo + 1
	});
	const edgesWithCursor: BuildWithCursor[] = [{ total_count: data.total_count, workflow_runs, cursor: nextPageCursor }];

	if (!workflow_runs?.length) {
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	logger.info(`Found ${workflow_runs.length} workflow_runs`);
	logger.info(`First workflow_run.updated_at=${workflow_runs[0].updated_at}`);

	const builds = await getTransformedBuilds(workflow_runs, gitHubInstallationClient, logger);
	logger.info("Syncing Builds: finished");

	// When there are no valid builds return early with undefined JiraPayload so that no Jira calls are made
	if (!builds?.length) {
		return {
			edges: edgesWithCursor,
			jiraPayload: undefined
		};
	}

	const jiraPayload = {
		... transformRepositoryDevInfoBulk(repository, gitHubInstallationClient.baseUrl),
		builds
	};

	return {
		edges: edgesWithCursor,
		jiraPayload
	};
};
