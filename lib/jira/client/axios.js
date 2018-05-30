const axios = require('axios')
const getJiraDetails = require('./secret')
const jwt = require('atlassian-jwt')
const url = require('url')

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

/*
 * Atlassian API JWTs need to be generated per-request due to their use of
 * Query String Hashing (QSH) to prevent URL tampering. Unlike traditional JWTs,
 * QSH requires us to re-encode a JWT for each URL we request to. As a result,
 * it makes sense for us to simply create a new JWT for each request rather than
 * attempt to reuse them. This accomplished using Axios interceptors to
 * just-in-time add the token to a request before sending it.
 */
module.exports = (config, repository) => {
  const { baseURL, secret } = getJiraDetails(config, repository)

  const instance = axios.create({
    baseURL
  })

  instance.interceptors.request.use((config) => {
    const { query, pathname } = url.parse(config.url, true)

    const jwtToken = jwt.encode({
      ...getExpirationInSeconds(),
      iss: 'com.github.integration',
      qsh: jwt.createQueryStringHash({
        method: config.method,
        originalUrl: pathname,
        query
      })
    }, secret)

    return {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `JWT ${jwtToken}`
      }
    }
  })

  return instance
}
