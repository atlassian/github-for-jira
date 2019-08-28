const { Installation } = require('../../models')
const getAxiosInstance = require('./axios')
const { getJiraId } = require('../util/id')

// Max number of issue keys we can pass to the Jira API
const ISSUE_KEY_API_LIMIT = 100

/**
 * Deduplicates elements in an array
 */
const dedup = (array) => [...new Set(array)]

/**
 * Deduplicates the issueKeys field for branches and commits
 */
const dedupIssueKeys = (resources) => {
  resources.forEach(resource => {
    resource.issueKeys = dedup(resource.issueKeys)
  })
  return resources
}

/**
 * Returns if the max length of the issue
 * key field is within the limit
 */
const withinIssueKeyLimit = (resources) => {
  if (resources == null) return []

  const issueKeyCounts = resources.map((resource) => resource.issueKeys.length)
  return Math.max(...issueKeyCounts) <= ISSUE_KEY_API_LIMIT
}

/*
 * Similar to the existing Octokit rest.js instance included in probot
 * apps by default, this client adds a Jira client that allows us to
 * abstract away the underlying HTTP requests made for each action. In
 * general, the client should match the Octokit rest.js design for clear
 * interoperability.
 */
module.exports = async (id, installationId, jiraHost) => {
  const { jiraHost: baseURL, sharedSecret: secret } = await Installation.getForHost(jiraHost)

  const instance = getAxiosInstance(id, installationId, baseURL, secret)

  const client = {
    baseURL: instance.defaults.baseURL,
    issues: {
      get: (issueId, params = { fields: 'summary' }) => {
        return instance.get(`/rest/api/latest/issue/${issueId}`, { params })
      },
      getAll: async (issueIds, query) => (await Promise.all(issueIds.map(issueId => client.issues.get(issueId, query).catch(error => error))))
        .filter(response => response.status === 200)
        .map(response => response.data),
      parse: (text) => {
        const jiraIssueRegex = /[A-Z]+-[0-9]+/g
        if (!text) return null
        return text.match(jiraIssueRegex)
      },
      comments: {
        getForIssue: (issueId) => instance.get(`/rest/api/latest/issue/${issueId}/comment`),
        addForIssue: (issueId, payload) => instance.post(`/rest/api/latest/issue/:${issueId}/comment`, payload)
      },
      transitions: {
        getForIssue: (issueId) => instance.get(`/rest/api/latest/issue/${issueId}/transitions`),
        updateForIssue: (issueId, transitionId) => {
          return instance.post(`/rest/api/latest/issue/${issueId}/transitions`, { transition: { id: transitionId } })
        }
      },
      worklogs: {
        getForIssue: (issueId) => instance.get(`/rest/api/latest/issue/${issueId}/worklog`),
        addForIssue: (issueId, payload) => instance.post(`/rest/api/latest/issue/${issueId}/worklog`, payload)
      }
    },
    devinfo: {
      branch: {
        delete: (repositoryId, branchRef) => {
          const path = `/rest/devinfo/0.10/repository/${repositoryId}/branch/${getJiraId(branchRef)}`
          return instance.delete(path, { params: { _updateSequenceId: Date.now() } })
        }
      },
      // Add methods for handling installationId properties that exist in Jira
      installation: {
        exists: (gitHubInstallationId) => instance.get(`/rest/devinfo/0.10/existsByProperties?installationId=${gitHubInstallationId}`),
        delete: (gitHubInstallationId) => instance.delete(`/rest/devinfo/0.10/bulkByProperties?installationId=${gitHubInstallationId}`)
      },
      // Migration endpoints do not take any parameters,
      // but return 500 errors if the body is empty or null.
      // Passing an empty object gets around this issue.
      migration: {
        complete: () => instance.post('/rest/devinfo/0.10/github/migrationComplete', {}),
        undo: () => instance.post('/rest/devinfo/0.10/github/undoMigration', {})
      },
      pullRequest: {
        delete: (repositoryId, number) => {
          const path = `/rest/devinfo/0.10/repository/${repositoryId}/pull_request/${number}`
          return instance.delete(path, { params: { _updateSequenceId: Date.now() } })
        }
      },
      repository: {
        get: (repositoryId) => instance.get(`/rest/devinfo/0.10/repository/${repositoryId}`),
        delete: (repositoryId) => {
          const path = `/rest/devinfo/0.10/repository/${repositoryId}`
          return instance.delete(path, { params: { _updateSequenceId: Date.now() } })
        },
        update: async (data, options) => {
          // Deduplicate issue keys in commits and branches before request
          if ('commits' in data) data.commits = dedupIssueKeys(data.commits)
          if ('branches' in data) {
            data.branches = dedupIssueKeys(data.branches)
            data.branches.forEach(branch => {
              if ('lastCommit' in branch) {
                branch.lastCommit = dedupIssueKeys([branch.lastCommit])[0]
              }
            })
          }

          if (withinIssueKeyLimit(data.commits) && withinIssueKeyLimit(data.branches)) {
            instance.post('/rest/devinfo/0.10/bulk', {
              preventTransitions: (options && options.preventTransitions) || false,
              repositories: [data],
              properties: {
                installationId
              }
            })
          } else {
            // We have more than 100 issue keys so raise an exception
            throw new Error('A commit exceeded referenced issue key limit')
          }
        }
      }
    }
  }

  return client
}
