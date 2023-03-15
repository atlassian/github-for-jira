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

type BuildWithCursor = { cursor: number } & Octokit.ActionsListRepoWorkflowRunsResponse;

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
	const pageSizeCoef = await numberFlag(NumberFlags.INCREASE_BUILDS_AND_PRS_PAGE_SIZE_COEF, 0, jiraHost);
	if (!pageSizeCoef) {
		return doGetBuildTask(logger, gitHubInstallationClient, jiraHost, repository, cursor, perPage, messagePayload);
	} else {
		// GitHub PR API has limits to 100 items per page, therefore we cannot multiply to more than 5
		// Fetch in parallel instead. Given that's an expermient for a single customer, let's not
		// overcomplicate it too much and limit ourselves to 2 pages.
		const limitedPageSizeCoef = Math.min(5, pageSizeCoef);
		const shouldFetchNextPageInParallel = pageSizeCoef > 5;

		const scaledPageSize = perPage * limitedPageSizeCoef;

		// Cursor 1, 2, 3, 4, 5 should be mapped to scaled cursor 1;
		// Cursor 6, 7, 8, 9, 10 shoul be mapped to scaled cursor 2;
		// etc
		// Given that the page counter starts from 1, we need to deduct 1 first and then add 1 back to the outcome
		const scaledCursor = 1 + Math.floor((Number(cursor) - 1) / limitedPageSizeCoef);

		const data = await fetchNextPagesInParallel(
			shouldFetchNextPageInParallel ? 10 : 1,
			scaledCursor,
			(scaledPageNoToFetch) =>
				doGetBuildTask(
					logger, gitHubInstallationClient, jiraHost, repository,
					scaledPageNoToFetch,
					scaledPageSize,
					messagePayload
				)
		);

		(data.edges || []).forEach(edge => {
			// Cursor is scaled... scaling back!
			// original pages: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
			// scaled pages:   ----1--------, --------2-----
			// Same as above: the counter starts from 1, therefore need to deduct it first and then add back to the result
			edge.cursor = 1 + (edge.cursor - 1) * limitedPageSizeCoef;
		});

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
	cursor = Number(cursor);

	const useIncrementalBackfill = await booleanFlag(BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL, jiraHost);
	const fromDate = useIncrementalBackfill && messagePayload?.commitsFromDate ? new Date(messagePayload.commitsFromDate) : undefined;
	const { data } = await gitHubInstallationClient.listWorkflowRuns(repository.owner.login, repository.name, perPage, cursor, fromDate);
	const { workflow_runs } = data;
	const nextPage = cursor + 1;
	const edgesWithCursor: BuildWithCursor[] = [{ total_count: data.total_count, workflow_runs, cursor: nextPage }];

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
