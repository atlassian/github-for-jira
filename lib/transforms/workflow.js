const parseSmartCommit = require('./smart-commit');

// We need to map the status and conclusion of a GitHub workflow back to a valid build state in Jira.
// https://docs.github.com/en/rest/reference/actions#list-workflow-runs-for-a-repository
// Workflow status - GitHub: Can be one of queued, in_progress, or completed.
// Workflow conclusion - GitHub: Can be one of action_required, cancelled, failure, neutral, success, skipped, stale, or timed_out
// https://developer.atlassian.com/cloud/jira/software/rest/api-group-builds/#api-builds-0-1-bulk-post
// Build state - Jira: Can be one of pending, in_progress, successful, failed, cancelled, unknown
function mapStatus({ status, conclusion }) {
  let key = status;
  if (conclusion) key += `.${conclusion}`;
  switch (key) {
    case 'queued':
    case 'in_progress':
      return 'in_progress';
    case 'completed.success':
    case 'completed.neutral':
    case 'completed.skipped':
      return 'successful';
    case 'completed.failure':
    case 'completed.timed_out':
      return 'failed';
    case 'completed.cancelled':
    case 'completed.stale':
      return 'cancelled';
    case 'completed.action_required':
      return 'pending';
    default:
      return 'unknown';
  }
}

function mapPullRequests(pull_requests) {
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
module.exports = async (payload) => {
  const { workflow_run } = payload;
  const { issueKeys } = parseSmartCommit(`${workflow_run.head_branch}\n${workflow_run.head_commit.message}`);

  if (!issueKeys) {
    return { data: undefined };
  }

  let data = {
    data: {
      product: 'GitHub Actions',
      builds: [{
        schemaVersion: '1.0',
        pipelineId: workflow_run.id,
        buildNumber: workflow_run.run_number,
        updateSequenceNumber: Date.now(),
        displayName: workflow_run.name,
        // description: workflow_run.output.summary || undefined,
        url: workflow_run.html_url,
        state: mapStatus(workflow_run),
        lastUpdated: workflow_run.updated_at,
        issueKeys,
      }],
    },
  };

  // Optional information that links PRs. Min items: 1, Max items: 5
  if (workflow_run.pull_requests.length > 0) {
    data.builds.references = mapPullRequests(workflow_run.pull_requests).slice(0, 5);
  }

  return data;
};
