import Sequelize from 'sequelize';
import logger from '../config/logger';
import { EnvironmentEnum } from "../config/env";

const nodeEnv = process.env.NODE_ENV || EnvironmentEnum.development;
// TODO: config misses timezone config to force to UTC, defaults to local timezone of PST
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../../db/config.json')[nodeEnv];

config.benchmark = true;
config.logging = config.disable_sql_logging
  ? undefined
  : (query, ms) => logger.trace({ms}, query);

export const sequelize = config.use_env_variable
  ? new Sequelize.Sequelize(process.env[config.use_env_variable], config)
  : new Sequelize.Sequelize(config);
