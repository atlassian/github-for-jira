import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { transformWorkflow } from "../transforms/transform-workflow";
import { WorkflowPayload } from "../config/interfaces";

type BuildWithCursor = { cursor: number } & Octokit.ActionsListRepoWorkflowRunsResponse;

const getTransformedBuilds = async (workflowRun, gitHubInstallationClient, logger) => {
	const transformTasks = await workflowRun.reduce(async (acc, current) => {
		const workflowItem = { workflow_run: current, workflow: { id: current.id } } as WorkflowPayload;
		const build = await transformWorkflow(gitHubInstallationClient, workflowItem, logger);
		if (build?.builds) {
			(await acc).push(build?.builds);
		}
		return await acc
	}, []);

	const transformedBuilds = await Promise.all(transformTasks);

	return transformedBuilds.flat();
}

export const getBuildTask = async (
	logger: LoggerWithTarget,
	_github: GitHubAPI,
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

	// Force us to go to a non-existant page if we're past the max number of pages
	const nextPage = cursor + 1;

	// Attach the "cursor" (next page number) to each edge, because the function that uses this data
	// fetches the cursor from one of the edges instead of letting us return it explicitly.
	const edgesWithCursor: BuildWithCursor[] = [{ total_count: data.total_count, workflow_runs, cursor: nextPage }];

	// Return early if no data to process
	if (workflow_runs.length === 0) {
		return {
			edges: [],
			jiraPayload: undefined
		};
	}

	const builds = await getTransformedBuilds(workflow_runs, gitHubInstallationClient, logger); 
	logger.info("Syncing Builds: finished");

	// When there are no valid builds return early with undefined JiraPayload so that no Jira calls are made
	if (!builds || builds.length === 0) {
		return {
			edges: edgesWithCursor,
			jiraPayload: undefined
		};
	}

	const jiraPayload = {
		id: repository.id,
		name: repository.full_name,
		builds,
		url: repository.html_url,
		updateSequenceId: Date.now()
	};

	return {
		edges: edgesWithCursor,
		jiraPayload
	};
};