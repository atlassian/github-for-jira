import issueKeyParser from "jira-issue-key-parser";
import { Context } from "probot/lib/context";
import { GitHubPullRequest } from "../interfaces/github";
import { JiraBuildData, JiraPullRequest } from "../interfaces/jira";

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
//
// function findJiraIssueKeysFromPR() {
//
// }

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

export default (context: Context): JiraBuildData | undefined => {
	const { workflow_run, workflow } = context.payload;

	/*
	* 1. Grab the pr
	* 2. Get the commits from that PR max 250
	* 3. Get the message for every commit
	* 4. Check if there's a Jira issue key on that message
	* 5. Add to issueKeys const
	*
	* */

	const issueKeys = issueKeyParser().parse(`${workflow_run.head_branch}\n${workflow_run.head_commit.message}`);

	if (!issueKeys) {
		return undefined;
	}

	return {
		product: "GitHub Actions",
		builds: [{
			schemaVersion: "1.0",
			pipelineId: workflow.id,
			buildNumber: workflow_run.run_number,
			updateSequenceNumber: Date.now(),
			displayName: workflow_run.name,
			url: workflow_run.html_url,
			state: mapStatus(workflow_run.status, workflow_run.conclusion),
			lastUpdated: workflow_run.updated_at,
			issueKeys,
			references: workflow_run.pull_requests?.length ? mapPullRequests(workflow_run.pull_requests).slice(0, 5) : undefined // Optional information that links PRs. Min items: 1, Max items: 5
		}],
	};
};
