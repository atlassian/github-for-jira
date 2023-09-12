import Logger from "bunyan";
import { GitHubPullRequest, GitHubWorkflowPayload } from "interfaces/github";
import { JiraBuildBulkSubmitData, JiraPullRequestHead } from "interfaces/jira";
import { getAllCommitMessagesBetweenReferences } from "./util/github-api-requests";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { jiraIssueKeyParser } from "utils/jira-utils";

// We need to map the status and conclusion of a GitHub workflow back to a valid build state in Jira.
// https://docs.github.com/en/rest/reference/actions#list-workflow-runs-for-a-repository
// Workflow status - GitHub: Can be one of queued, in_progress, or completed.
// Workflow conclusion - GitHub: Can be one of action_required, cancelled, failure, neutral, success, skipped, stale, or timed_out
// https://developer.atlassian.com/cloud/jira/software/rest/api-group-builds/#api-builds-0-1-bulk-post
// Build state - Jira: Can be one of pending, in_progress, successful, failed, cancelled, unknown
const mapStatus = (status: string, conclusion?: string): string => {
	let key = status;
	if (conclusion) key += `.${conclusion}`;
	switch (key) {
		case "queued":
		case "in_progress":
			return "in_progress";
		case "completed.success":
		case "completed.neutral":
		case "completed.skipped":
			return "successful";
		case "completed.failure":
		case "completed.timed_out":
			return "failed";
		case "completed.cancelled":
		case "completed.stale":
			return "cancelled";
		case "completed.action_required":
			return "pending";
		default:
			return "unknown";
	}
};

const mapPullRequests = (
	pull_requests: GitHubPullRequest[] = []
): JiraPullRequestHead[] => {
	return pull_requests.map((pr) => ({
		commit: {
			id: pr.head.sha,
			repositoryUri: pr.head.repo.url
		},
		ref: {
			name: pr.head.ref,
			uri: `${pr.head.repo.url}/tree/${pr.head.ref}`
		}
	}));
};

export const transformWorkflow = async (
	githubClient: GitHubInstallationClient,
	payload: GitHubWorkflowPayload,
	alwaysSend: boolean,
	logger: Logger
): Promise<JiraBuildBulkSubmitData | undefined> => {
	const {
		workflow_run: {
			conclusion,
			head_branch,
			html_url,
			name,
			pull_requests,
			repository,
			run_number,
			status,
			updated_at
		}, workflow
	} = payload;

	const workflowHasPullRequest = !!pull_requests?.length;

	const commitMessages = workflowHasPullRequest ? await getAllCommitMessagesBetweenReferences(
		{
			owner: repository.owner.login,
			repo: repository.name,
			base: pull_requests[0].base.ref,
			head: pull_requests[0].head.ref
		},
		githubClient,
		logger
	) : "";

	const issueKeys = jiraIssueKeyParser(`${head_branch}\n${payload.workflow_run.head_commit?.message ?? ""}\n${commitMessages}`);
	if (!issueKeys.length && !alwaysSend) {
		return undefined;
	}

	const maxPullRequestReferences = mapPullRequests(pull_requests).slice(0, 5);

	return {
		product: "GitHub Actions",
		builds: [
			{
				schemaVersion: "1.0",
				pipelineId: workflow.id,
				buildNumber: run_number,
				updateSequenceNumber: Date.now(),
				displayName: name,
				url: html_url,
				state: mapStatus(status, conclusion),
				lastUpdated: updated_at,
				issueKeys,
				references: workflowHasPullRequest
					? maxPullRequestReferences
					: undefined // Optional information that links PRs.
			}
		]
	};
};
