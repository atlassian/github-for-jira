const Bottleneck = require('bottleneck')
const cacheManager = require('cache-manager')
const memoryCache = cacheManager.caching({ store: 'memory', max: 1000, ttl: 60 })

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
