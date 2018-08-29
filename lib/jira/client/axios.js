const axios = require('axios')
const jwt = require('atlassian-jwt')
const url = require('url')
const { logger } = require('probot/lib/logger')

const instance = process.env.INSTANCE_NAME
const iss = 'com.github.integration' + (instance ? `.${instance}` : '')

function getAuthMiddleware (secret) {
  return (config) => {
    const { query, pathname } = url.parse(config.url, true)

    const jwtToken = jwt.encode({
      ...getExpirationInSeconds(),
      iss,
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
  }
}

function getErrorMiddleware (id, installationId) {
  return (error) => {
    const { status, statusText } = error.response || {}
    logger.debug({
      id,
      installation: installationId,
      params: error.config.fields
    }, `Jira request: ${error.request.method} ${error.request.path} - ${status} ${statusText}`)

    if (error.response) {
      return Promise.reject(error.response.data)
    }

    return Promise.reject(error)
  }
}

function getSuccessMiddleware (id, installationId) {
  return (response) => {
    logger.debug({
      id,
      installation: installationId,
      params: response.config.fields
    }, `Jira request: ${response.config.method.toUpperCase()} ${response.config.originalUrl} - ${response.status} ${response.statusText}`)

    return response
  }
}

function getUrlMiddleware () {
  return (config) => {
    let { query, pathname, ...rest } = url.parse(config.url, true)
    config.fields = config.fields || {}

    for (let field in config.fields) {
      if (pathname.includes(`:${field}`)) {
        pathname = pathname.replace(`:${field}`, config.fields[field])
      } else {
        query[field] = config.fields[field]
      }
    }

    config.fields['baseUrl'] = config.baseURL

    return {
      ...config,
      originalUrl: config.url,
      url: url.format({
        ...rest,
        pathname,
        query
      })
    }
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
module.exports = (id, installationId, baseURL, secret) => {
  const instance = axios.create({
    baseURL
  })

  instance.interceptors.request.use(getAuthMiddleware(secret))
  instance.interceptors.request.use(getUrlMiddleware())

  instance.interceptors.response.use(
    getSuccessMiddleware(id, installationId),
    getErrorMiddleware(id, installationId)
  )

  return instance
}
