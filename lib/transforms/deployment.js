const parseSmartCommit = require('./smart-commit');

// We need to map the state of a GitHub deployment back to a valid deployment state in Jira.
// https://docs.github.com/en/rest/reference/repos#list-deployments
// Deployment state - GitHub: Can be one of error, failure, pending, in_progress, queued, or success
// https://developer.atlassian.com/cloud/jira/software/rest/api-group-builds/#api-deployments-0-1-bulk-post
// Deployment state - Jira: Can be one of unknown, pending, in_progress, cancelled, failed, rolled_back, successful
function mapState({ state }) {
  switch (state) {
    case 'queued':
    case 'pending':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'success':
      return 'successful';
    case 'error':
    case 'failure':
      return 'failed';
    default:
      return 'unknown';
  }
}

function mapEnvironment({ environment }) {
  // We need to map the environment of a GitHub deployment back to a valid deployment environment in Jira.
  // https://docs.github.com/en/actions/reference/environments
  // GitHub: does not have pre-defined values and users can name their environments whatever they like. We try to map as much as we can here and log the unmapped ones.
  // Jira: Can be one of unmapped, development, testing, staging, production
  const isEnvironment = (envNames) =>
    envNames.some(envName => environment.localeCompare(envName, undefined, { sensitivity: 'base', ignorePunctuation: true }) === 0);

  const environmentMapping = {
    development: ['development', 'dev', 'trunk'],
    testing: ['testing', 'test', 'tests', 'tst', 'integration', 'integ', 'intg', 'int', 'acceptance', 'accept', 'acpt', 'qa', 'qc', 'control', 'quality'],
    staging: ['staging', 'stage', 'stg', 'preprod', 'model', 'internal'],
    production: ['production', 'prod', 'live'],
  };

  const jiraEnv = Object.keys(environmentMapping).find(key => isEnvironment(environmentMapping[key]));

  if (!jiraEnv) {
    return 'unmapped';
  }

  return jiraEnv;
}

module.exports = async (context) => {
  const { github, payload: { deployment_status, deployment } } = context;
  const { data: { commit: { message } } } = await github.repos.getCommit(context.repo({ ref: deployment.sha }));
  const { issueKeys } = parseSmartCommit(`${deployment.ref}\n${message}`);

  if (!issueKeys) {
    return { data: undefined };
  }

  const environment = mapEnvironment(deployment_status);
  if (environment === 'unmapped') {
    context.log(`Unmapped environment detected for deployment. Unmapped value is ${deployment_status}. Sending it as unmapped to Jira.`);
  }

  return {
    data: {
      deployments: [{
        schemaVersion: '1.0',
        deploymentSequenceNumber: deployment.id,
        updateSequenceNumber: deployment_status.id,
        issueKeys,
        displayName: deployment.task,
        url: deployment_status.log_url || deployment_status.target_url,
        description: deployment.description || deployment_status.description || deployment.task,
        lastUpdated: deployment_status.updated_at,
        state: mapState(deployment_status),
        pipeline: {
          id: deployment.task,
          displayName: deployment.task,
          url: deployment_status.log_url || deployment_status.target_url,
        },
        environment: {
          id: deployment_status.environment,
          displayName: deployment_status.environment,
          type: environment,
        },
      }],
    },
  };
};
