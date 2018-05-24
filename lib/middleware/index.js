const bot = require('./bot')
const config = require('./config')
const jira = require('./jira')
const util = require('./util')

module.exports = function middleware (callback) {
  const middlewares = [bot, config, jira, util]

  return async (context) => {
    let newContext = context

    for (let middleware of middlewares) {
      newContext = await middleware(context)

      if (!newContext) {
        return
      }
    }

    await callback(context)
  }
}
