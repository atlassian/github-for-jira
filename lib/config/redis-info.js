const url = require('url');
const logger = require('../../config/logger');
const Sequelize = require('sequelize');

const env = process.env.NODE_ENV || 'development';
const config = require('../../db/config.json')[env];

const REDIS_URL = process.env.REDIS_BOTTLENECK_HOST || '127.0.0.1';
const redisInfo = url.parse(REDIS_URL);
const REDIS_PORT = process.env.REDIS_BOTTLENECK_PORT || redisInfo.port || 6379;

/** @type {string} */
let password = null;
if (redisInfo.auth && redisInfo.auth.split(':').length === 2) {
  password = redisInfo.auth.split(':')[1];
}

let sequelize;
if (config.use_env_variable) {
  logger.info(`initializing Sequelize: NODE_ENV=${process.env.NODE_ENV}, env var name=${config.use_env_variable}, env var value=${process.env[config.use_env_variable]}`);
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
  logger.info(`SEQUELIZE config.use_env_variable: ${sequelize}`);
} else {
  logger.info(`initializing Sequelize via username and password: NODE_ENV=${process.env.NODE_ENV}`);
  sequelize = new Sequelize(config.database, config.username, config.password, config);
  logger.info(`SEQUELIZE: ${sequelize}`);
}

/**
 * @param {string} connectionName - The name for the connection
 * @returns {{REDIS_URL: string, redisOptions: import('ioredis').RedisOptions}}
 */
module.exports = (connectionName) => ({
  REDIS_URL,
  redisOptions: {
    password,
    port: REDIS_PORT,
    host: REDIS_URL,
    db: redisInfo.pathname ? redisInfo.pathname.split('/')[1] : 0,
    connectionName,
  },
});
