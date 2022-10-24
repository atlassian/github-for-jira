import { Octokit } from "@octokit/rest";
import Logger from "bunyan";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { transformWorkflow } from "../transforms/transform-workflow";
import { GitHubWorkflowPayload } from "~/src/interfaces/github";
import { transformRepositoryDevInfoBulk } from "~/src/transforms/transform-repository";
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
	_jiraHost: string,
	repository: Repository,
	cursor: string | number = 1,
	perPage?: number
) => {
	logger.info("Syncing Builds: started");
	cursor = Number(cursor);

	const { data } = await gitHubInstallationClient.listWorkflowRuns(repository.owner.login, repository.name, perPage, cursor);
	const { workflow_runs } = data;
	const nextPage = cursor + 1;
	const edgesWithCursor: BuildWithCursor[] = [{ total_count: data.total_count, workflow_runs, cursor: nextPage }];

	if (!workflow_runs?.length) {
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

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
