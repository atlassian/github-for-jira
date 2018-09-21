module.exports = () => {
  if (process.env.SETUP) {
    // stop only if setup did run. If using jest --watch and no tests are matched
    // we need to not execute the require() because it will fail
    require('../lib/worker').stop()
  }
}
