const axios = require('axios')
const getJiraDetails = require('./secret')
const jwt = require('atlassian-jwt')
const querystring = require('querystring')

/*
 * The Atlassian API uses JSON Web Tokens (JWT) for authentication along with
 * Query String Hashing (QSH) to prevent URL tampering. IAT, or issued-at-time,
 * is a Unix-style timestamp of when the token was issued. EXP, or expiration
 * time, is a Unix-style timestamp of when the token expires and must be no
 * more than three minutes after the IAT. Since our tokens are per-request and
 * short-lived, we use a timeout of 30 seconds.
 */
function getExpirationInSeconds () {
  const nowInSeconds = Math.floor(Date.now() / 1000)

  return {
    iat: nowInSeconds,
    exp: nowInSeconds + 30
  }
}

module.exports = (context) => {
  const { secret, baseURL } = getJiraDetails()

  function request (method, path, query = {}, data = undefined, options = {}) {
    const url = baseURL + '/rest/api/latest' + path

    const jwtToken = jwt.encode({
      ...getExpirationInSeconds(),
      iss: 'com.github.integration',
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
