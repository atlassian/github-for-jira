const OctokitError = require('../models/octokit-error')
const statsd = require('./statsd')

const instrumentRequests = (octokit, log) => {
  octokit.hook.wrap('request', async (request, options) => {
    const requestStart = Date.now()
    try {
      const response = await request(options)
      return response
    } finally {
      const elapsed = Date.now() - requestStart
      statsd.histogram('github-request', elapsed, { path: options.url })
      log.debug(`GitHub request time: ${elapsed}ms`)
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
