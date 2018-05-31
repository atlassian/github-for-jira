const getAxiosInstance = require('./axios')
const querystring = require('querystring')

/*
 * Similar to the existing Octokit rest.js instance included in probot
 * apps by default, this client adds a Jira client that allows us to
 * abstract away the underlying HTTP requests made for each action. In
 * general, the client should match the Octokit rest.js design for clear
 * interoperability.
 */

module.exports = (config, repository) => {
  const instance = getAxiosInstance(config, repository)

  const client = {
    baseURL: instance.defaults.baseURL,
    issues: {
      baseURL: '/rest/api/latest/issue',
      get: (issueKey, query) => instance.get(`${client.issues.baseURL}/${issueKey}?${querystring.stringify(query)}`)
    },
    devinfo: {
      baseURL: '/rest/developmenttool/0.9/devinfo',
      getRepository: (repositoryId) => instance.get(`${client.devinfo.baseURL}/repository/${repositoryId}`),
      deleteRepository: (repositoryId) => instance.delete(`${client.devinfo.baseURL}/repository/${repositoryId}`),
      deleteEntity: (repositoryId, entityType, entityId) =>
        instance.delete(`${client.devinfo.baseURL}/repository/${repositoryId}/${entityType}/${entityId}`),
      deleteBulkByProperties: (data) => instance.delete(`${client.devinfo.baseURL}/bulkByProperties`),
      updateBulk: (data) => instance.post(`${client.devinfo.baseURL}/bulk`, {
        preventTransitions: false,
        repositories: data
      })
    }
  }

  return client
}
