const getAxiosInstance = require('./axios')
const querystring = require('querystring')

/*
 * Similar to the existing Octokit rest.js instance included in probot
 * apps by default, this client adds a Jira client that allows us to
 * abstract away the underlying HTTP requests made for each action. In
 * general, the client should match the Octokit rest.js design for clear
 * interoperability.
 */
module.exports = (id, installationId, config, repository) => {
  const instance = getAxiosInstance(id, installationId, config, repository)

  return {
    baseURL: instance.defaults.baseURL,
    issues: {
      get: (issue_id, query) => instance.get(`/rest/api/latest/issue/:issue_id`, {
        fields: {
          ...query,
          issue_id
        }
      })
    },
    devinfo: {
      updateRepository: (data) => instance.post('/rest/developmenttool/0.9/devinfo/bulk', {
        preventTransitions: false,
        repositories: [data]
      })
    }
  }
}
