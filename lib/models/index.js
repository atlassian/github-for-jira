const Sequelize = require('sequelize')
const env = process.env.NODE_ENV || 'development'
const config = require('../../db/config.json')[env]
const { logger } = require('probot/lib/logger')

const InstallationModel = require('./installation')
const SubscriptionModel = require('./subscription')

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

const models = {
  Installation: InstallationModel.init(sequelize, Sequelize),
  Subscription: SubscriptionModel.init(sequelize, Sequelize)
}

Object.values(models)
  .filter(model => typeof model.associate === 'function')
  .forEach(model => model.associate(models))

module.exports = {
  ...models,
  sequelize,
  Sequelize
}
