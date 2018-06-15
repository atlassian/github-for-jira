const getAxiosInstance = require('./axios')
const getJiraDetails = require('./secret')

/*
 * Similar to the existing Octokit rest.js instance included in probot
 * apps by default, this client adds a Jira client that allows us to
 * abstract away the underlying HTTP requests made for each action. In
 * general, the client should match the Octokit rest.js design for clear
 * interoperability.
 */
module.exports = async (id, installationId, jiraHost) => {
  const { baseURL, secret } = await getJiraDetails(jiraHost)
  const instance = getAxiosInstance(id, installationId, baseURL, secret)

  return {
    baseURL: instance.defaults.baseURL,
    issues: {
      // eslint-disable-next-line camelcase
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
