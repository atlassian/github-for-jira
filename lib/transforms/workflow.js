const parseSmartCommit = require('./smart-commit');

function mapStatus({ status, conclusion }) {
  if (status === 'queued') {
    return 'in_progress';
  } else if (status === 'in_progress') {
    return 'in_progress';
  } else if (status === 'completed') {
    if (conclusion === 'success' || conclusion === 'neutral') {
      return 'successful';
    } else if (conclusion === 'failure' || conclusion === 'timed_out') {
      return 'failed';
    } else if (conclusion === 'cancelled' || conclusion === 'stale') {
      return 'cancelled';
    } else if (conclusion === 'action_required') {
      return 'pending';
    } else {
      return 'unknown';
    }
  } else {
    return 'unknown';
  }
}

module.exports = (payload) => {
  const { workflow_run } = payload;
  const { issueKeys } = parseSmartCommit(workflow_run.head_branch);

  if (!issueKeys) {
    return { data: undefined };
  }

  return {
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
        references: workflow_run.pull_requests.map(pr => (
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
        )),
      }],
    },
  };
};
