const getAxiosInstance = require('../jira/client/axios')

class JiraClient {
  constructor (installation, log) {
    this.axios = getAxiosInstance(installation.jiraHost, installation.sharedSecret, log)
  }

  /*
   * Tests credentials by making a request to the Jira API
   *
   * @return {boolean} Returns true if client has access to Jira API
   */
  async isAuthorized () {
    try {
      const response = await this.axios.get(`/rest/devinfo/0.10/existsByProperties?fakeProperty=1`)
      return response.status === 200
    } catch (error) {
      if (error.response) {
        return false
      } else {
        throw error
      }
    }
  }
}

module.exports = JiraClient
