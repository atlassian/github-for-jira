const TIMEOUT = Number(process.env.REQUEST_TIMEOUT_MS || 25000)

module.exports = function webhookTimeout (callback) {
  return async (context) => {
    const timestamp = new Date()
    const id = setTimeout(function () {
      context.timedout = (new Date() - timestamp)
    }, TIMEOUT)

    try {
      await callback(context)
    } finally {
      clearTimeout(id)
    }
  }
}
