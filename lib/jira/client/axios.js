const axios = require('axios')
const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const getJiraDetails = require('./secret')
const jwt = require('atlassian-jwt')
const url = require('url')

const logger = bunyan.createLogger({
  name: 'jira',
  level: 'debug',
  stream: bformat({ outputMode: 'short' })
})

function modifyPathWithFields(path, fields) {
  const { query, pathname, ...rest } = url.parse(path, true)

  const modifiedPathname = pathname.replace(/\/:([\w_]+)/, (match, p1) => `/${fields[p1]}`)
  const modifiedUrl = url.format({
    ...rest,
    pathname: modifiedPathname,
    query
  })

  return {
    modifiedPathname,
    modifiedUrl,
    query
  }
}

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
module.exports = (id, installationId, config, repository) => {
  const { baseURL, secret } = getJiraDetails(config, repository)

  const instance = axios.create({
    baseURL
  })

  instance.interceptors.request.use((config) => {
    const { modifiedPathname, modifiedUrl, query } = modifyPathWithFields(config.url, config.fields)

    const jwtToken = jwt.encode({
      ...getExpirationInSeconds(),
      iss: 'com.github.integration',
      qsh: jwt.createQueryStringHash({
        method: config.method,
        originalUrl: modifiedPathname,
        query
      })
    }, secret)

    return {
      ...config,
      originalUrl: config.url,
      url: modifiedUrl,
      headers: {
        ...config.headers,
        Authorization: `JWT ${jwtToken}`
      }
    }
  })

  instance.interceptors.response.use((response) => {
    logger.debug({
      id,
      installation: installationId,
      params: response.config.fields
    }, `Jira request: ${response.config.method.toUpperCase()} ${response.config.originalUrl} - ${response.status} ${response.statusText}`)

    return response
  }, (error) => {
    logger.debug({
      id,
      installation: installationId,
      params: error.config.fields
    }, `Jira request: ${error.request.method} ${error.request.path} - ${error.response.status} ${error.response.statusText}`)

    if (error.response) {
      return Promise.reject(error.response.data)
    }

    return Promise.reject(error)
  })

  return instance
}
