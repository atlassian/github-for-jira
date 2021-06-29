const parseSmartCommit = require('./smart-commit');

// We need to map the state of a GitHub deployment back to a valid deployment state in Jira.
// https://docs.github.com/en/rest/reference/repos#list-deployments
// Deployment state - GitHub: Can be one of error, failure, pending, in_progress, queued, or success
// https://developer.atlassian.com/cloud/jira/software/rest/api-group-builds/#api-deployments-0-1-bulk-post
// Deployment state - Jira: Can be one of unknown, pending, in_progress, cancelled, failed, rolled_back, successful
function mapState({ state }) {
  switch (state) {
    case 'queued':
      return 'pending';
    case 'pending':
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

function mapEnvironment({ environment }, isProdEnvironment) {
  // We need to map the environment of a GitHub deployment back to a valid deployment environment in Jira.
  // https://docs.github.com/en/actions/reference/environments
  // GitHub: does not have pre-defined values and users can name their environments whatever they like. We try to map as much as we can here and log the unmapped ones.
  // Jira: Can be one of unmapped, development, testing, staging, production
  if (isProdEnvironment) {
    return 'production';
  }

  const isEnvironment = (envName) =>
    environment.localeCompare(envName, undefined, { sensitivity: 'base', ignorePunctuation: true }) === 0;

  if (isEnvironment('development') || isEnvironment('dev') || isEnvironment('trunk')) {
    return 'development';
  } else if (isEnvironment('testing') || isEnvironment('test') || isEnvironment('tests')
    || isEnvironment('tst')
    || isEnvironment('integration') || isEnvironment('integ') || isEnvironment('intg')
    || isEnvironment('int')
    || isEnvironment('acceptance') || isEnvironment('accept') || isEnvironment('acpt')
    || isEnvironment('qa') || isEnvironment('qc') || isEnvironment('control')
    || isEnvironment('quality')) {
    return 'testing';
  } else if (isEnvironment('staging') || isEnvironment('stage') || isEnvironment('stg')
    || isEnvironment('preprod') || isEnvironment('model') || isEnvironment('internal')) {
    return 'staging';
  } else if (isEnvironment('production') || isEnvironment('prod') || isEnvironment('live')) {
    return 'production';
  } else {
    app.log.info(`Unmapped environment detected for deployment. Unmapped value is ${environment}. Sending it as unmapped to Jira.`);
    return 'unmapped';
  }
}

module.exports = async (context) => {
  const { github, payload: { deployment_status, deployment } } = context;
  const { data: { commit: { message } } } = await github.repos.getCommit(context.repo({ ref: deployment.sha }));
  const { issueKeys } = parseSmartCommit(`${deployment.ref}\n${message}`);

  if (!issueKeys) {
    return { data: undefined };
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
          type: mapEnvironment(deployment_status, deployment.production_environment),
        },
      }],
    },
  };
};
