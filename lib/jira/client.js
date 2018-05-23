const axios = require('axios')
const getJiraDetails = require('./secret')
const jwt = require('atlassian-jwt')
const moment = require('moment')
const querystring = require('querystring')

module.exports = () => {
  const { secret, baseURL } = getJiraDetails()

  function request (method, path, query = {}, data = undefined, options = {}) {
    const now = moment().utc()
    const url = baseURL + '/rest/api/latest' + path

    const jwtToken = jwt.encode({
      iss: 'com.github.integration',
      iat: now.unix(),
      exp: now.add(3, 'minutes').unix(),
      qsh: jwt.createQueryStringHash({
        method,
        originalUrl: url,
        query
      })
    }, secret)

    return axios({
      url: `${url}?${querystring.stringify(query)}`,
      baseURL,
      method,
      data,
      headers: {
        Authorization: `JWT ${jwtToken}`,
        ...options.headers
      }
    })
  }

  return {
    baseURL,
    issues: {
      get: (issueId, query) => request('GET', `/issue/${issueId}`, query)
    }
  }
}
