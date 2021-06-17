import Sequelize from "sequelize";
import { logger } from "probot/lib/logger";

const nodeEnv = process.env.NODE_ENV || "development";
// TODO: config misses timezone config to force to UTC, defaults to local timezone of PST
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require("../../db/config.json")[nodeEnv];

config.benchmark = true;
config.logging = config.disable_sql_logging
  ? undefined
  : (query, ms) => logger.debug({ ms }, query);
console.info(`Node Env: ${nodeEnv}`);
console.info(`use_env_variable: ${config.use_env_variable}`);
console.info(`Env Var Value: ${process.env[config.use_env_variable]}`);
export const sequelize = new Sequelize.Sequelize(config);
