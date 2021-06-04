const parseSmartCommit = require('./smart-commit');

function mapState({ state }) {
  // jira: unknown, pending, in_progress, cancelled, failed, rolled_back, successful
  // gh: error, failure, inactive, in_progress, queued, pending, success
  if (state === 'queued') {
    return 'pending';
  } else if (state === 'pending' || state === 'in_progress') {
    return 'in_progress';
  } else if (state === 'success') {
    return 'successful';
  } else if (state === 'error' || state === 'failure') {
    return 'failed';
  } else if (state === 'inactive') {
    return 'rolled_back';
  } else {
    return 'unknown';
  }
}

function mapEnvironment({ environment }, isProdEnvironment) {
  // jira: unmapped, development, testing, staging, production
  // gh: free-form string
  if (isProdEnvironment === true) {
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
