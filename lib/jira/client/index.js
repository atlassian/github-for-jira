const { Installation, Subscription } = require('../../models');
const getAxiosInstance = require('./axios');
const { getJiraId } = require('../util/id');
const newrelic = require('newrelic');
const isProd = require('../util/isProd');

// Max number of issue keys we can pass to the Jira API
const ISSUE_KEY_API_LIMIT = 100;

/*
 * Similar to the existing Octokit rest.js instance included in probot
 * apps by default, this client adds a Jira client that allows us to
 * abstract away the underlying HTTP requests made for each action. In
 * general, the client should match the Octokit rest.js design for clear
 * interoperability.
 */
async function getJiraClient(jiraHost, gitHubInstallationId, logger) {
  const installation = await Installation.getForHost(jiraHost);
  if (installation == null) {
    return;
  }
  const instance = getAxiosInstance(installation.jiraHost, installation.sharedSecret, logger);

  const client = {
    baseURL: instance.defaults.baseURL,
    issues: {
      // eslint-disable-next-line camelcase
      get: (issue_id, query = { fields: 'summary' }) => instance.get('/rest/api/latest/issue/:issue_id', {
        fields: {
          ...query,
          issue_id,
        },
      }),
      getAll: async (issueIds, query) => (await Promise.all(issueIds.map(issueId => client.issues.get(issueId, query).catch(error => error))))
        .filter(response => response.status === 200)
        .map(response => response.data),
      parse: (text) => {
        const jiraIssueRegex = /[A-Z]+-[0-9]+/g;
        if (!text) return null;
        return text.match(jiraIssueRegex);
      },
      comments: {
        // eslint-disable-next-line camelcase
        getForIssue: (issue_id) => instance.get('/rest/api/latest/issue/:issue_id/comment', {
          fields: {
            issue_id,
          },
        }),
        // eslint-disable-next-line camelcase
        addForIssue: (issue_id, payload) => instance.post('/rest/api/latest/issue/:issue_id/comment', payload, {
          fields: {
            issue_id,
          },
        }),
      },
      transitions: {
        // eslint-disable-next-line camelcase
        getForIssue: (issue_id) => instance.get('/rest/api/latest/issue/:issue_id/transitions', {
          fields: {
            issue_id,
          },
        }),
        // eslint-disable-next-line camelcase
        updateForIssue: (issue_id, transition_id) => instance.post('/rest/api/latest/issue/:issue_id/transitions', {
          transition: {
            id: transition_id,
          },
        }, {
          fields: {
            issue_id,
          },
        }),
      },
      worklogs: {
        // eslint-disable-next-line camelcase
        getForIssue: (issue_id) => instance.get('/rest/api/latest/issue/:issue_id/worklog', {
          fields: {
            issue_id,
          },
        }),
        // eslint-disable-next-line camelcase
        addForIssue: (issue_id, payload) => instance.post('/rest/api/latest/issue/:issue_id/worklog', payload, {
          fields: {
            issue_id,
          },
        }),
      },
    },
    devinfo: {
      branch: {
        delete: (repositoryId, branchRef) => instance.delete('/rest/devinfo/0.10/repository/:repositoryId/branch/:branchJiraId', {
          fields: {
            _updateSequenceId: Date.now(),
            repositoryId,
            branchJiraId: getJiraId(branchRef),
          },
        }),
      },
      // Add methods for handling installationId properties that exist in Jira
      installation: {
        exists: (gitHubInstallationId) => instance.get(`/rest/devinfo/0.10/existsByProperties?installationId=${gitHubInstallationId}`),
        delete: (gitHubInstallationId) => instance.delete(`/rest/devinfo/0.10/bulkByProperties?installationId=${gitHubInstallationId}`),
      },
      // Migration endpoints do not take any parameters,
      // but return 500 errors if the body is empty or null.
      // Passing an empty object gets around this issue.
      migration: {
        complete: async () => {
          /**
           * Only call github/migrationComplete in prod. Complete will only be called in Jira if
           * GITHUB_CONNECT_APP_IDENTIFIER is equal to com.github.integration.production
           */
          if (!isProd()) return;
          await instance.post('/rest/devinfo/0.10/github/migrationComplete', {});
        },
        undo: async () => {
          /**
           * Only call github/migrationUndo in prod. Undo will only be called in Jira if
           * GITHUB_CONNECT_APP_IDENTIFIER is equal to com.github.integration.production
           */
          if (!isProd()) return;
          await instance.post('/rest/devinfo/0.10/github/undoMigration', {});
        },
      },
      pullRequest: {
        delete: (repositoryId, pullRequestId) => instance.delete('/rest/devinfo/0.10/repository/:repositoryId/pull_request/:pullRequestId', {
          fields: {
            _updateSequenceId: Date.now(),
            repositoryId,
            pullRequestId,
          },
        }),
      },
      repository: {
        get: (repositoryId) => instance.get('/rest/devinfo/0.10/repository/:repositoryId', { fields: { repositoryId } }),
        delete: (repositoryId) => instance.delete('/rest/devinfo/0.10/repository/:repositoryId', {
          fields: {
            _updateSequenceId: Date.now(),
            repositoryId,
          },
        }),
        update: async (data, options) => {
          dedupIssueKeys(data);

          if (!withinIssueKeyLimit(data.commits) || !withinIssueKeyLimit(data.branches)) {
            truncateIssueKeys(data);
            const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId);
            await subscription.update({ syncWarning: 'Exceeded issue key reference limit. Some issues may not be linked.' });
          }

          await batchedBulkUpdate(data, options, instance, gitHubInstallationId);
        },
      },
    },
    workflow: {
      submit: async (data) => {
        updateIssueKeysFor(data.builds, dedup);
        if (!withinIssueKeyLimit(data.builds)) {
          updateIssueKeysFor(data.builds, truncate);
          const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId);
          await subscription.update({ syncWarning: 'Exceeded issue key reference limit. Some issues may not be linked.' });
        }
        const payload = {
          builds: data.builds,
          properties: {
            gitHubInstallationId,
          },
          providerMetadata: {
            product: data.product,
          },
        };
        logger.info(`Sending builds payload to jira. Payload: ${payload}`);
        await instance.post('/rest/builds/0.1/bulk', payload);
      },
    },
    deployment: {
      submit: async (data) => {
        updateIssueKeysFor(data.deployments, dedup);
        if (!withinIssueKeyLimit(data.deployments)) {
          updateIssueKeysFor(data.deployments, truncate);
          const subscription = await Subscription.getSingleInstallation(jiraHost, gitHubInstallationId);
          await subscription.update({ syncWarning: 'Exceeded issue key reference limit. Some issues may not be linked.' });
        }
        const payload = {
          deployments: data.deployments,
          properties: {
            gitHubInstallationId,
          },
        };
        logger.info(`Sending deployments payload to jira. Payload: ${payload}`);
        await instance.post('/rest/deployments/0.1/bulk', payload);
      },
    },
  };

  return client;
}

module.exports = async (...args) => newrelic.startSegment('lib/jira/client: getJiraClient', true, async () => getJiraClient(...args));

/**
 * Splits commits in data payload into chunks of 400 and makes separate requests
 * to avoid Jira API limit
 */
const batchedBulkUpdate = (data, options, instance, installationId) => {
  const dedupedCommits = dedupCommits(data.commits);

  // Initialize with an empty chunk of commits so we still process the request if there are no commits in the payload
  const commitChunks = [];
  do {
    commitChunks.push(dedupedCommits.splice(0, 400));
  } while (dedupedCommits.length);

  const batchedUpdates = commitChunks.map((commitChunk) => {
    if (commitChunk.length) {
      data.commits = commitChunk;
    }

    return instance.post('/rest/devinfo/0.10/bulk', {
      preventTransitions: (options && options.preventTransitions) || false,
      repositories: [data],
      properties: {
        installationId,
      },
    });
  });
  Promise.all(batchedUpdates);
};

/**
 * Returns if the max length of the issue
 * key field is within the limit
 */
const withinIssueKeyLimit = (resources) => {
  if (resources == null) return [];

  const issueKeyCounts = resources.map((resource) => resource.issueKeys.length);
  return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT;
};

/**
 * Deduplicates commits by ID field for a repository payload
 */
const dedupCommits = (commits) => (commits || []).filter((obj, pos, arr) => arr.map(mapCommit => mapCommit.id).indexOf(obj.id) === pos);

/**
 * Deduplicates issueKeys field for branches and commits
 */
const dedupIssueKeys = (repositoryObj) => {
  updateRepositoryIssueKeys(repositoryObj, dedup);
};

/**
 * Truncates branches and commits to first 100 issue keys for branch or commit
 */
const truncateIssueKeys = (repositoryObj) => {
  updateRepositoryIssueKeys(repositoryObj, truncate);
};

/**
 * Runs a mutating function on all branches and commits
 * with issue keys in a Jira Repository object
 */
const updateRepositoryIssueKeys = (repositoryObj, mutatingFunc) => {
  if ('commits' in repositoryObj) repositoryObj.commits = updateIssueKeysFor(repositoryObj.commits, mutatingFunc);
  if ('branches' in repositoryObj) {
    repositoryObj.branches = updateIssueKeysFor(repositoryObj.branches, mutatingFunc);
    repositoryObj.branches.forEach(branch => {
      if ('lastCommit' in branch) {
        branch.lastCommit = updateIssueKeysFor([branch.lastCommit], mutatingFunc)[0];
      }
    });
  }
};

/**
 * Runs the mutatingFunc on the issue keys field for each branch or commit
 */
const updateIssueKeysFor = (resources, mutatingFunc) => {
  resources.forEach(resource => {
    resource.issueKeys = mutatingFunc(resource.issueKeys);
  });
  return resources;
};

/**
 * Deduplicates elements in an array
 */
const dedup = (array) => [...new Set(array)];

/**
 * Truncates to 100 elements in an array
 */
const truncate = (array) => array.slice(0, ISSUE_KEY_API_LIMIT);
