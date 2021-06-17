import Sequelize from "sequelize";
import { logger } from "probot/lib/logger";

// TODO: config misses timezone config to force to UTC, defaults to local timezone of PST
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("../../db/config.json")[
process.env.NODE_ENV || "development"
  ];

config.benchmark = true;
config.logging = config.disable_sql_logging
  ? undefined
  : (query, ms) => logger.debug({ ms }, query);
console.info(`use_env_variable: ${config.use_env_variable}`);
console.info(`Env Var Value: ${process.env[config.use_env_variable]}`);
export const sequelize = config.use_env_variable
  ? new Sequelize.Sequelize(process.env[config.use_env_variable], config)
  : new Sequelize.Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
