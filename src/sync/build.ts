import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { Repository } from "models/subscription";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { transformWorkflow } from "../transforms/transform-workflow";
import { WorkflowPayload } from "../config/interfaces";

type BuildWithCursor = { cursor: number } & Octokit.ActionsListRepoWorkflowRunsResponse;

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

	//todo-jk reduce
	// Transform all the build items at once, result will be array of arrays so flatten for JiraPayload
	const builds = (await Promise.all(workflow_runs.map(async (run) => {
		const workflowItem = { workflow_run: run, workflow: { id: run.id } } as unknown as WorkflowPayload;
		const build = await transformWorkflow(gitHubInstallationClient, workflowItem, logger);
		return build?.builds;
	}))).flat().filter(build => !!build);

	logger.info("Syncing Builds: finished");

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