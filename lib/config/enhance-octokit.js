const OctokitError = require('../models/octokit-error')
const statsd = require('./statsd')
const { extractPath } = require('../jira/client/axios')

const instrumentRequests = (octokit, log) => {
  octokit.hook.wrap('request', async (request, options) => {
    const requestStart = Date.now()
    let responseStatus = null

    try {
      const response = await request(options)
      responseStatus = response.status

      return response
    } catch (error) {
      if (error.responseCode) {
        responseStatus = error.responseCode
      }

      throw error
    } finally {
      const elapsed = Date.now() - requestStart
      const tags = {
        path: extractPath(options.url),
        method: options.method,
        status: responseStatus
      }

      statsd.histogram('github-request', elapsed, tags)
      log.debug(tags, `GitHub request time: ${elapsed}ms`)
    }
  })
}

/*
 * Customize an Octokit instance behavior.
 *
 * This acts like an Octokit plugin but works on Octokit instances.
 * (Because Probot instantiates the Octokit client for us, we can't use plugins.)
 */
module.exports = (octokit, log) => {
  OctokitError.wrapRequestErrors(octokit)
  instrumentRequests(octokit, log)

  return octokit
}
