const axios = require('axios')
const jwt = require('atlassian-jwt')
const querystring = require('querystring')
const url = require('url')

const { logger } = require('probot/lib/logger')

const instance = process.env.INSTANCE_NAME
const iss = 'com.github.integration' + (instance ? `.${instance}` : '')

/*
 * Create an Atlassian request from an Axios config.
 * Compatible with jwt.createQueryStringHash.
 */
jwt.reqFromAxiosConfig = (config) => {
  const parsedUrl = url.parse(config.url)
  const parsedQuery = querystring.parse(parsedUrl.query)

  return {
    method: config.method,
    originalUrl: parsedUrl.pathname,
    query: Object.assign(parsedQuery, config.params)
  }
}

function getAuthMiddleware (secret) {
  return (config) => {
    const qsh = jwt.createQueryStringHash(jwt.reqFromAxiosConfig(config))
    const jwtToken = jwt.encode({ ...getExpirationInSeconds(), iss, qsh }, secret)

    config.headers['Authorization'] = `JWT ${jwtToken}`

    return config
  }
}

function getErrorMiddleware (id, installationId) {
  return (error) => {
    if (error.response) {
      logResponse(id, installationId, error.response)
    }

    return Promise.reject(error)
  }
}

function getSuccessMiddleware (id, installationId) {
  return (response) => {
    logResponse(id, installationId, response)
    return response
  }
}

const logResponse = function (id, installationId, response) {
  const { status, statusText } = response
  const { method, path } = response.request

  logger.debug({ id, installation: installationId }, `Jira request: ${method} ${path} - ${status} ${statusText}`)
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
    baseURL,
    timeout: +process.env.JIRA_TIMEOUT || 20000
  })

  instance.interceptors.request.use(getAuthMiddleware(secret))

  instance.interceptors.response.use(
    getSuccessMiddleware(id, installationId),
    getErrorMiddleware(id, installationId)
  )

  return instance
}
