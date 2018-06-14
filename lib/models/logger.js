const bunyan = require('bunyan')
const bformat = require('bunyan-format')

module.exports = bunyan.createLogger({
  name: 'sequelize',
  level: 'debug',
  stream: bformat({ outputMode: 'short' })
})
