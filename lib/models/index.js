const Sequelize = require('sequelize')
const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const fs = require('fs')
const path = require('path')

const basename = path.basename(__filename)
const env = process.env.NODE_ENV || 'development'
const config = require('../../db/config.json')[env]

const db = {}
const logger = bunyan.createLogger({
  name: 'sequelize',
  level: 'debug',
  stream: bformat({ outputMode: 'short' })
})

Object.assign(config, {
  operatorsAliases: false,
  benchmark: true,
  logging: (query, ms) => {
    logger.debug({ ms }, query)
  }
})

let sequelize
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config)
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config)
}

fs
  .readdirSync(__dirname)
  .filter(file =>
    (file.indexOf('.') !== 0) &&
    (file !== basename) &&
    (file.slice(-3) === '.js')
  )
  .forEach(file => {
    const model = sequelize.import(path.join(__dirname, file))
    db[model.name] = model
  })

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

db.sequelize = sequelize
db.Sequelize = Sequelize

module.exports = db
