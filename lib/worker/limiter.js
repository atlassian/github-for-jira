const Bottleneck = require('bottleneck')
const cacheManager = require('cache-manager')
const memoryCache = cacheManager.caching({ store: 'memory', max: 1000, ttl: 60 })

/**
 * @param processor
 * Limits each job processor to LIMITER_PER_INSTALLATION (in ms)
 * Defaults to 1000ms (1 second)
 * Set this to a higher number to limit how often each
 * installation can call the GitHub API during initial sync
 */
module.exports = function limterPerInstallation (processor) {
  return async job => {
    const limiter = await memoryCache.wrap(job.data.installationId, () => {
      return new Bottleneck({
        maxConcurrent: 1,
        minTime: Number(process.env.LIMITER_PER_INSTALLATION) || 1000
      })
    })

    await limiter.wrap(processor)(job)
  }
}
