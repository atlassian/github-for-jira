import issueKeyParser from "jira-issue-key-parser";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import { GitHubPullRequest } from "../interfaces/github";
import { JiraBuildData, JiraPullRequest } from "../interfaces/jira";
import { GitHubAPI } from "probot";
import { compareCommitsBetweenBaseAndHeadBranches } from "./util/githubApiRequests";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { BuildsPayload } from "../config/interfaces";

// We need to map the status and conclusion of a GitHub workflow back to a valid build state in Jira.
// https://docs.github.com/en/rest/reference/actions#list-workflow-runs-for-a-repository
// Workflow status - GitHub: Can be one of queued, in_progress, or completed.
// Workflow conclusion - GitHub: Can be one of action_required, cancelled, failure, neutral, success, skipped, stale, or timed_out
// https://developer.atlassian.com/cloud/jira/software/rest/api-group-builds/#api-builds-0-1-bulk-post
// Build state - Jira: Can be one of pending, in_progress, successful, failed, cancelled, unknown
function mapStatus(status: string, conclusion?: string): string {
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
}

function mapPullRequests(pull_requests: GitHubPullRequest[]): JiraPullRequest[] {
	return pull_requests.map(pr => (
		{
			commit: {
				id: pr.head.sha,
				repositoryUri: pr.head.repo.url,
			},
			ref: {
				name: pr.head.ref,
				uri: `${pr.head.repo.url}/tree/${pr.head.ref}`,
			},
		}
	));
}

// TODO - WRITE TEST FOR  compareCommitsBetweenBaseAndHeadBranches
// TODO - see if tests exist for this and see if they still pass, update if needed, or maybe write more
// TODO - write build doc
export default async (
	githubClient: GitHubAPI,
	payload: BuildsPayload,
	jiraHost: string,
	logger?: LoggerWithTarget
): Promise<JiraBuildData | undefined> => {
	const { workflow_run, workflow } = payload;

	const {
		conclusion,
		head_branch,
		head_commit,
		html_url,
		name,
		pull_requests,
		repository,
		run_number,
		status,
		updated_at
	} = workflow_run;

	let issueKeys;

	const supportBranchAndMergeWorkflowForBuildsFlagIsOn = await booleanFlag(BooleanFlags.SUPPORT_BRANCH_AND_MERGE_WORKFLOWS_FOR_BUILDS, true, jiraHost);

	if (supportBranchAndMergeWorkflowForBuildsFlagIsOn && pull_requests?.length > 0) {
		const compareCommitsPayload = {
			owner: repository.owner.login,
			repo: repository.name,
			base: pull_requests[0]?.base.ref,
			head: pull_requests[0]?.head.ref
		}

		const allCommitMessages = await compareCommitsBetweenBaseAndHeadBranches(
			compareCommitsPayload,
			githubClient,
			logger
		);

		issueKeys = issueKeyParser().parse(`${head_branch}\n${head_commit.message}\n${allCommitMessages}`) || [];
	} else {
		issueKeys = issueKeyParser().parse(`${head_branch}\n${head_commit.message}`) || [];
	}

	if (!issueKeys) {
		return undefined;
	}

	return {
		product: "GitHub Actions",
		builds: [{
			schemaVersion: "1.0",
			pipelineId: workflow.id.toString(),
			buildNumber: run_number,
			updateSequenceNumber: Date.now(),
			displayName: name,
			url: html_url,
			state: mapStatus(status, conclusion),
			lastUpdated: updated_at,
			issueKeys,
			references: pull_requests?.length ? mapPullRequests(pull_requests).slice(0, 5) : undefined // Optional information that links PRs. Min items: 1, Max items: 5
		}],
	};
};
